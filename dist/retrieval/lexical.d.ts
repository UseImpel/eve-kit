import type { RetrievalScope, WikiDoc } from "./types.js";
export type LexicalHit = {
    path: string;
    score: number;
};
export declare class LexicalIndex {
    private entries;
    constructor(docs: WikiDoc[]);
    search(query: string, k: number, scope?: RetrievalScope): LexicalHit[];
}
//# sourceMappingURL=lexical.d.ts.map