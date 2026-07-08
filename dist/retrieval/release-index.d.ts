import { InMemoryVectorStore } from "./vector-store.js";
import type { Embedder, EmbeddedDoc } from "./types.js";
export declare const RELEASE_INDEX_V2_PATH = "wiki/_meta/index/manifest.json";
export type LoadStats = {
    total: number;
    carried: number;
    backfilled: number;
    format: "v2";
};
export declare function loadReleaseIndex(opts: {
    path: string;
    embedder?: Embedder;
}): Promise<{
    store: InMemoryVectorStore;
    docs: EmbeddedDoc[];
    embedder: Embedder;
    stats: LoadStats;
}>;
//# sourceMappingURL=release-index.d.ts.map