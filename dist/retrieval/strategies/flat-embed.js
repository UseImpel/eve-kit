import { confidenceFrom } from "../helpers.js";
// Simplest baseline: embed the query, return nearest pages by cosine. No lexical
// signal, no rerank — the floor every other strategy must beat in evals.
export class FlatEmbedStrategy {
    deps;
    name = "flat-embed";
    constructor(deps) {
        this.deps = deps;
    }
    async retrieve(query) {
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
//# sourceMappingURL=flat-embed.js.map