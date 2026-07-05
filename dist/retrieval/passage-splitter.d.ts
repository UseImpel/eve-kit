export type PassageDoc = {
    pageId: string;
    passageIndex: number;
    text: string;
    embedding?: number[];
};
export declare function splitPassages(content: string, maxPassageLength?: number): string[];
//# sourceMappingURL=passage-splitter.d.ts.map