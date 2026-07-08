export type SidecarPassageInfo = {
    index: number;
    charOffset: number;
    charLength: number;
};
export type SidecarManifest = {
    modelId: string;
    dimensions: number;
    passageCount: number;
    passages: SidecarPassageInfo[];
};
export type EmbeddingSidecar = {
    manifest: SidecarManifest;
    vectors: number[][];
};
export declare function sidecarFileName(contentHash: string, modelId: string, dimensions: number): string;
export declare function serializeSidecar(sidecar: EmbeddingSidecar): Buffer;
export declare function deserializeSidecar(buffer: Buffer): EmbeddingSidecar;
//# sourceMappingURL=embedding-sidecar.d.ts.map