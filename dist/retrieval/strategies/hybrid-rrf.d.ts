import type { Embedder, RetrievalQuery, RetrievalResult, RetrievalStrategy, VectorStore, WikiDoc } from "../types.js";
export declare class HybridRrfStrategy implements RetrievalStrategy {
    private deps;
    readonly name = "hybrid-rrf";
    private lexical;
    private docs;
    constructor(deps: {
        embedder: Embedder;
        store: VectorStore;
        docs: WikiDoc[];
    });
    retrieve(query: RetrievalQuery): Promise<RetrievalResult>;
}
//# sourceMappingURL=hybrid-rrf.d.ts.map