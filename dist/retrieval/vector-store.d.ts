import type { EmbeddedDoc, RetrievalScope, ScoredChunk, VectorStore } from "./types.js";
export declare class InMemoryVectorStore implements VectorStore {
    private docs;
    private passages;
    upsert(docs: EmbeddedDoc[]): Promise<void>;
    upsertPassages(passages: Array<{
        pageId: string;
        index: number;
        text: string;
        embedding: number[];
    }>): Promise<void>;
    query(args: {
        embedding: number[];
        k: number;
        scope?: RetrievalScope;
    }): Promise<ScoredChunk[]>;
    private queryPassages;
    size(): number;
}
//# sourceMappingURL=vector-store.d.ts.map