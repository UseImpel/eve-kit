import { confidenceFrom } from "../helpers.js";
import type {
  Embedder,
  RetrievalQuery,
  RetrievalResult,
  RetrievalStrategy,
  VectorStore,
} from "../types.js";

// Simplest baseline: embed the query, return nearest pages by cosine. No lexical
// signal, no rerank — the floor every other strategy must beat in evals.
export class FlatEmbedStrategy implements RetrievalStrategy {
  readonly name = "flat-embed";

  constructor(private deps: { embedder: Embedder; store: VectorStore }) {}

  async retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
    const [embedding] = await this.deps.embedder([query.query]);
    const chunks = await this.deps.store.query({
      embedding,
      k: query.k ?? 8,
      scope: query.scope,
    });
    return {
      chunks,
      confidence: confidenceFrom(chunks),
      strategy: this.name,
    };
  }
}
