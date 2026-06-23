import type { Embedder, RetrievalStrategy, VectorStore, WikiDoc } from "../types.js";
import { FlatEmbedStrategy } from "./flat-embed.js";
import { HybridRrfStrategy } from "./hybrid-rrf.js";
import { SectionAwareStrategy } from "./section-aware.js";
export { FlatEmbedStrategy, HybridRrfStrategy, SectionAwareStrategy };
export type StrategyDeps = {
    embedder: Embedder;
    store: VectorStore;
    docs?: WikiDoc[];
};
export declare const strategyNames: readonly ["flat-embed", "hybrid-rrf", "section-aware"];
export type StrategyName = (typeof strategyNames)[number];
export declare function buildStrategy(name: StrategyName, deps: StrategyDeps): RetrievalStrategy;
//# sourceMappingURL=index.d.ts.map