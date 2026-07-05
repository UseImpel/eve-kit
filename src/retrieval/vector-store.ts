import { cosineSimilarity } from "ai";
import { clamp01, inScope, snippet } from "./helpers.js";
import type {
  EmbeddedDoc,
  RetrievalScope,
  ScoredChunk,
  VectorStore,
} from "./types.js";

// Internal representation of a passage with its vector
type PassageEntry = {
  pageId: string;
  index: number;
  text: string;
  embedding: number[];
};

// In-memory cosine store — the offline eval fixture and the default for the
// harness. The persistent pgvector store will implement this same VectorStore
// interface, so strategies don't change when storage does.
export class InMemoryVectorStore implements VectorStore {
  private docs = new Map<string, EmbeddedDoc>();

  // Passages support: grouped by pageId, lazily populated
  // If empty, fall back to page-level search (v1 compat)
  private passages = new Map<string, PassageEntry[]>();

  async upsert(docs: EmbeddedDoc[]): Promise<void> {
    for (const doc of docs) {
      this.docs.set(doc.path, doc);
    }
  }

  // Upsert passages for v2 artifacts. Called by release-index loader when
  // loading v2 manifest or v1 index (as single-passage pages).
  async upsertPassages(passages: Array<{
    pageId: string;
    index: number;
    text: string;
    embedding: number[];
  }>): Promise<void> {
    // Group passages by pageId
    const grouped = new Map<string, PassageEntry[]>();
    for (const passage of passages) {
      const key = passage.pageId;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push({
        pageId: passage.pageId,
        index: passage.index,
        text: passage.text,
        embedding: passage.embedding,
      });
    }

    // Store grouped passages
    for (const [pageId, pagePassages] of grouped) {
      this.passages.set(pageId, pagePassages);
    }
  }

  async query(args: {
    embedding: number[];
    k: number;
    scope?: RetrievalScope;
  }): Promise<ScoredChunk[]> {
    // If we have passages (v2 artifacts or v1 fallback), search at passage level
    // and deduplicate to pages. Otherwise, fall back to page-level search.
    if (this.passages.size > 0) {
      return this.queryPassages(args);
    }

    // Fallback: page-level search (when no passages have been upserted)
    const scored: ScoredChunk[] = [];
    for (const doc of this.docs.values()) {
      if (!inScope(doc, args.scope)) continue;
      scored.push({
        path: doc.path,
        title: doc.title,
        score: clamp01(cosineSimilarity(args.embedding, doc.embedding)),
        snippet: snippet(doc.content),
        vault: doc.vault,
        section: doc.section,
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, args.k);
  }

  // Query at passage level and deduplicate to pages.
  // For each page, the score is its best passage's cosine similarity.
  // The snippet is the top passage's text.
  private async queryPassages(args: {
    embedding: number[];
    k: number;
    scope?: RetrievalScope;
  }): Promise<ScoredChunk[]> {
    // Score all passages
    const scoredPassages: Array<{
      passage: PassageEntry;
      score: number;
      doc: EmbeddedDoc;
    }> = [];

    for (const [pageId, pagePassages] of this.passages) {
      const doc = this.docs.get(pageId);
      if (!doc) continue; // Page deleted?
      if (!inScope(doc, args.scope)) continue;

      for (const passage of pagePassages) {
        const score = clamp01(
          cosineSimilarity(args.embedding, passage.embedding)
        );
        scoredPassages.push({ passage, score, doc });
      }
    }

    // Sort by score
    scoredPassages.sort((a, b) => b.score - a.score);

    // Deduplicate to pages: keep the highest-scoring passage per page
    const pageResults = new Map<string, { score: number; passage: PassageEntry; doc: EmbeddedDoc }>();
    for (const { passage, score, doc } of scoredPassages) {
      if (!pageResults.has(doc.path)) {
        pageResults.set(doc.path, { score, passage, doc });
      }
    }

    // Convert to ScoredChunk[], sorted by score
    const chunks: ScoredChunk[] = Array.from(pageResults.values())
      .map(({ score, passage, doc }) => ({
        path: doc.path,
        title: doc.title,
        score,
        snippet: snippet(passage.text), // passage text, not page text
        vault: doc.vault,
        section: doc.section,
      }))
      .sort((a, b) => b.score - a.score);

    return chunks.slice(0, args.k);
  }

  size(): number {
    return this.docs.size;
  }
}
