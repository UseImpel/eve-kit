import { confidenceFrom, reciprocalRankFusion, snippet } from "../helpers.js";
import { LexicalIndex } from "../lexical.js";
import type {
  Embedder,
  RetrievalQuery,
  RetrievalResult,
  RetrievalStrategy,
  ScoredChunk,
  VectorStore,
  WikiDoc,
} from "../types.js";

// Hybrid retrieval: semantic cosine + weighted lexical search, fused by RRF. Beats
// pure cosine when the query shares exact terms with a page, and beats pure lexical
// when it's a paraphrase. The baseline-to-beat for the section-hierarchical work.
export class HybridRrfStrategy implements RetrievalStrategy {
  readonly name = "hybrid-rrf";
  private lexical: LexicalIndex;
  private docs: Map<string, WikiDoc>;

  constructor(
    private deps: { embedder: Embedder; store: VectorStore; docs: WikiDoc[] }
  ) {
    this.lexical = new LexicalIndex(deps.docs);
    this.docs = new Map(deps.docs.map((doc) => [doc.path, doc]));
  }

  async retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
    const k = query.k ?? 8;
    // Pull a deeper pool from each retriever than we return, so fusion has room to
    // promote an item that's mid-ranked in both lists but agreed on by both.
    const pool = Math.max(k * 4, 20);
    const [embedding] = await this.deps.embedder([query.query]);
    const [semantic, lexical] = await Promise.all([
      this.deps.store.query({ embedding, k: pool, scope: query.scope }),
      Promise.resolve(this.lexical.search(query.query, pool, query.scope)),
    ]);

    const fused = reciprocalRankFusion([
      semantic.map((hit) => hit.path),
      lexical.map((hit) => hit.path),
    ]);

    const chunks: ScoredChunk[] = [];
    for (const { path, score } of fused.slice(0, k)) {
      const doc = this.docs.get(path);
      if (!doc) continue;
      chunks.push({
        path: doc.path,
        title: doc.title,
        score,
        snippet: snippet(doc.content),
        vault: doc.vault,
        section: doc.section,
      });
    }

    return {
      chunks,
      confidence: confidenceFrom(chunks),
      strategy: this.name,
    };
  }
}
