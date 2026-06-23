import type { Embedder, RetrievalQuery, RetrievalResult, RetrievalStrategy, VectorStore, WikiDoc } from "../types.js";
export declare class SectionAwareStrategy implements RetrievalStrategy {
    private deps;
    readonly name = "section-aware";
    private lexical;
    private docs;
    private resolveLink;
    constructor(deps: {
        embedder: Embedder;
        store: VectorStore;
        docs: WikiDoc[];
    });
    retrieve(query: RetrievalQuery): Promise<RetrievalResult>;
}
//# sourceMappingURL=section-aware.d.ts.map