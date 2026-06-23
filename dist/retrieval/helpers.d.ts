import type { RetrievalScope, ScoredChunk, WikiDoc } from "./types.js";
export declare function clamp01(n: number): number;
export declare function inScope(doc: WikiDoc, scope?: RetrievalScope): boolean;
export declare function snippet(content: string): string;
export declare function confidenceFrom(chunks: ScoredChunk[]): number;
export declare function reciprocalRankFusion(lists: string[][]): Array<{
    path: string;
    score: number;
}>;
//# sourceMappingURL=helpers.d.ts.map