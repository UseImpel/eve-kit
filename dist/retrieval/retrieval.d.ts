import type { EvidenceGateDecision } from "./evidence-gate.js";
import type { StrategyName } from "./strategies/index.js";
import type { Embedder, RetrievalResult, RetrievalScope, RetrievalStrategy, VectorStore, WikiDoc } from "./types.js";
export type RetrievalOptions = {
    store: VectorStore;
    embedder: Embedder;
    docs?: WikiDoc[];
    strategy?: StrategyName;
    floor?: number;
};
export type RetrievalAnswer = RetrievalResult & {
    gate: EvidenceGateDecision;
};
export type FromReleaseIndexOptions = {
    path?: string;
    vault?: string;
    embedder?: Embedder;
    strategy?: StrategyName;
    floor?: number;
};
export declare class Retrieval {
    readonly strategy: RetrievalStrategy;
    private readonly floor?;
    constructor(opts: RetrievalOptions);
    static fromReleaseIndex(opts?: FromReleaseIndexOptions): Promise<Retrieval>;
    query(query: string, opts?: {
        k?: number;
        scope?: RetrievalScope;
        floor?: number;
    }): Promise<RetrievalAnswer>;
}
//# sourceMappingURL=retrieval.d.ts.map