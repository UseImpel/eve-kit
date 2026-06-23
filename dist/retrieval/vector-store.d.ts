import type { EmbeddedDoc, RetrievalScope, ScoredChunk, VectorStore } from "./types.js";
export declare class InMemoryVectorStore implements VectorStore {
    private docs;
    upsert(docs: EmbeddedDoc[]): Promise<void>;
    query(args: {
        embedding: number[];
        k: number;
        scope?: RetrievalScope;
    }): Promise<ScoredChunk[]>;
    size(): number;
}
//# sourceMappingURL=vector-store.d.ts.map