import type { Embedder, RetrievalQuery, RetrievalResult, RetrievalStrategy, VectorStore } from "../types.js";
export declare class FlatEmbedStrategy implements RetrievalStrategy {
    private deps;
    readonly name = "flat-embed";
    constructor(deps: {
        embedder: Embedder;
        store: VectorStore;
    });
    retrieve(query: RetrievalQuery): Promise<RetrievalResult>;
}
//# sourceMappingURL=flat-embed.d.ts.map