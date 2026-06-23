import type { Embedder } from "./types.js";
export declare const EMBEDDING_MODEL = "openai/text-embedding-3-large";
export declare const EMBEDDING_DIMENSIONS = 1536;
export declare function gatewayEmbedder(opts?: {
    model?: string;
    dimensions?: number;
}): Embedder;
//# sourceMappingURL=embedder.d.ts.map