import type { Embedder, EmbeddedDoc, VectorStore, WikiDoc } from "./types.js";
export declare function embeddingInput(doc: WikiDoc): string;
export declare function embedDocs(docs: WikiDoc[], embedder: Embedder): Promise<EmbeddedDoc[]>;
export declare function buildIndex(args: {
    docs: WikiDoc[];
    embedder: Embedder;
    store: VectorStore;
}): Promise<VectorStore>;
//# sourceMappingURL=index-builder.d.ts.map