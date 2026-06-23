import { readFile, writeFile } from "node:fs/promises";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./embedder.js";
import { InMemoryVectorStore } from "./vector-store.js";
export function serializeIndex(docs, meta) {
    return {
        version: 1,
        model: meta?.model ?? EMBEDDING_MODEL,
        dimensions: meta?.dimensions ?? EMBEDDING_DIMENSIONS,
        docs,
    };
}
export async function storeFromArtifact(artifact) {
    const store = new InMemoryVectorStore();
    await store.upsert(artifact.docs);
    return store;
}
export async function saveIndex(path, artifact) {
    await writeFile(path, JSON.stringify(artifact));
}
export async function loadIndex(path) {
    const artifact = JSON.parse(await readFile(path, "utf8"));
    if (artifact.version !== 1) {
        throw new Error(`unsupported index artifact version: ${artifact.version}`);
    }
    return artifact;
}
//# sourceMappingURL=index-store.js.map