import { InMemoryVectorStore } from "./vector-store.js";
import type { Embedder, EmbeddedDoc, WikiDoc } from "./types.js";
export declare const RELEASE_INDEX_PATH = "wiki/_meta/index.json";
export type ReleaseIndexDoc = WikiDoc & {
    contentHash?: string;
    embedding?: number[];
};
export type ReleaseIndex = {
    version: 1;
    model: string;
    dimensions: number;
    docs: ReleaseIndexDoc[];
};
export type LoadStats = {
    total: number;
    carried: number;
    backfilled: number;
};
export declare function parseReleaseIndex(json: string): ReleaseIndex;
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