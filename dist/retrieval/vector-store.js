import { cosineSimilarity } from "ai";
import { clamp01, inScope, snippet } from "./helpers.js";
// In-memory cosine store — the offline eval fixture and the default for the
// harness. The persistent pgvector store will implement this same VectorStore
// interface, so strategies don't change when storage does.
export class InMemoryVectorStore {
    docs = new Map();
    // Passages support: grouped by pageId, lazily populated
    // If empty, fall back to page-level search (v1 compat)
    passages = new Map();
    async upsert(docs) {
        for (const doc of docs) {
            this.docs.set(doc.path, doc);
        }
    }
    // Upsert passages for v2 artifacts. Called by release-index loader when
    // loading v2 manifest or v1 index (as single-passage pages).
    async upsertPassages(passages) {
        // Group passages by pageId
        const grouped = new Map();
        for (const passage of passages) {
            const key = passage.pageId;
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key).push({
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
    async query(args) {
        // If we have passages (v2 artifacts or v1 fallback), search at passage level
        // and deduplicate to pages. Otherwise, fall back to page-level search.
        if (this.passages.size > 0) {
            return this.queryPassages(args);
        }
        // Fallback: page-level search (when no passages have been upserted)
        const scored = [];
        for (const doc of this.docs.values()) {
            if (!inScope(doc, args.scope))
                continue;
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
    async queryPassages(args) {
        // Score all passages
        const scoredPassages = [];
        for (const [pageId, pagePassages] of this.passages) {
            const doc = this.docs.get(pageId);
            if (!doc)
                continue; // Page deleted?
            if (!inScope(doc, args.scope))
                continue;
            for (const passage of pagePassages) {
                const score = clamp01(cosineSimilarity(args.embedding, passage.embedding));
                scoredPassages.push({ passage, score, doc });
            }
        }
        // Sort by score
        scoredPassages.sort((a, b) => b.score - a.score);
        // Deduplicate to pages: keep the highest-scoring passage per page
        const pageResults = new Map();
        for (const { passage, score, doc } of scoredPassages) {
            if (!pageResults.has(doc.path)) {
                pageResults.set(doc.path, { score, passage, doc });
            }
        }
        // Convert to ScoredChunk[], sorted by score
        const chunks = Array.from(pageResults.values())
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
    size() {
        return this.docs.size;
    }
}
//# sourceMappingURL=vector-store.js.map