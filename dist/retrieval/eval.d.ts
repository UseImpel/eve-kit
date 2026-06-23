import { type StrategyName } from "./strategies/index.js";
import type { Embedder, RetrievalScope, VectorStore, WikiDoc } from "./types.js";
export type LabeledQuery = {
    query: string;
    expectedPath?: string;
    scope?: RetrievalScope;
};
export type StrategyReport = {
    strategy: StrategyName;
    n: number;
    hitAt1: number;
    hitAt5: number;
    mrr: number;
    outOfCorpus: number;
    abstainRate: number;
};
export declare function compareStrategies(args: {
    store: VectorStore;
    docs: WikiDoc[];
    embedder: Embedder;
    queries: LabeledQuery[];
    strategies: StrategyName[];
    k?: number;
    floor?: number;
}): Promise<StrategyReport[]>;
//# sourceMappingURL=eval.d.ts.map