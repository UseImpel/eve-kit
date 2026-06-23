export type WikiDoc = {
    path: string;
    title: string;
    content: string;
    vault?: string;
    section?: string;
    tags?: string[];
    links?: string[];
    pinned?: boolean;
};
export type EmbeddedDoc = WikiDoc & {
    embedding: number[];
};
export type ScoredChunk = {
    path: string;
    title: string;
    score: number;
    snippet: string;
    vault?: string;
    section?: string;
};
export type RetrievalScope = {
    vault?: string;
    sections?: string[];
};
export type RetrievalQuery = {
    query: string;
    scope?: RetrievalScope;
    k?: number;
};
export type RetrievalResult = {
    chunks: ScoredChunk[];
    confidence: number;
    strategy: string;
};
export interface RetrievalStrategy {
    readonly name: string;
    retrieve(query: RetrievalQuery): Promise<RetrievalResult>;
}
export type Embedder = (texts: string[]) => Promise<number[][]>;
export interface VectorStore {
    upsert(docs: EmbeddedDoc[]): Promise<void>;
    query(args: {
        embedding: number[];
        k: number;
        scope?: RetrievalScope;
    }): Promise<ScoredChunk[]>;
    size(): number;
}
//# sourceMappingURL=types.d.ts.map