import type { WikiDoc } from "./types.js";
export type ManifestEntry = {
    path: string;
    title: string;
    vault?: string;
    section?: string;
    tags?: string[];
    links?: string[];
    pinned?: boolean;
    contentHash?: string;
};
export type ManifestV2 = {
    version: 2;
    model: string;
    dimensions: number;
    pages: ManifestEntry[];
};
export type PagePassages = {
    texts: string[];
    vectors: number[][];
} | null;
export interface ManifestLoader {
    manifest: ManifestV2;
    getPageContent(path: string): Promise<string>;
    getPagePassages(path: string): Promise<PagePassages>;
    toPageDocs(): Promise<WikiDoc[]>;
}
export declare function loadManifest(opts: {
    manifestPath: string;
    baseDir?: string;
}): Promise<ManifestLoader>;
//# sourceMappingURL=manifest-loader.d.ts.map