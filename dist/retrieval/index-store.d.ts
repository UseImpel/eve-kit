import { InMemoryVectorStore } from "./vector-store.js";
import type { EmbeddedDoc } from "./types.js";
export type IndexArtifact = {
    version: 1;
    model: string;
    dimensions: number;
    docs: EmbeddedDoc[];
};
export declare function serializeIndex(docs: EmbeddedDoc[], meta?: {
    model?: string;
    dimensions?: number;
}): IndexArtifact;
export declare function storeFromArtifact(artifact: IndexArtifact): Promise<InMemoryVectorStore>;
export declare function saveIndex(path: string, artifact: IndexArtifact): Promise<void>;
export declare function loadIndex(path: string): Promise<IndexArtifact>;
//# sourceMappingURL=index-store.d.ts.map