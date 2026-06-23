import { readFile, writeFile } from "node:fs/promises";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./embedder.js";
import { InMemoryVectorStore } from "./vector-store.js";
import type { EmbeddedDoc } from "./types.js";

// A built index, persisted so retrieval doesn't re-embed every run — mirroring how
// the platform shipped page embeddings in the release manifest. `model` and
// `dimensions` are recorded because a query MUST be embedded with the same model
// for the vectors to be comparable; check them before querying a loaded index.
export type IndexArtifact = {
  version: 1;
  model: string;
  dimensions: number;
  docs: EmbeddedDoc[];
};

export function serializeIndex(
  docs: EmbeddedDoc[],
  meta?: { model?: string; dimensions?: number }
): IndexArtifact {
  return {
    version: 1,
    model: meta?.model ?? EMBEDDING_MODEL,
    dimensions: meta?.dimensions ?? EMBEDDING_DIMENSIONS,
    docs,
  };
}

export async function storeFromArtifact(
  artifact: IndexArtifact
): Promise<InMemoryVectorStore> {
  const store = new InMemoryVectorStore();
  await store.upsert(artifact.docs);
  return store;
}

export async function saveIndex(
  path: string,
  artifact: IndexArtifact
): Promise<void> {
  await writeFile(path, JSON.stringify(artifact));
}

export async function loadIndex(path: string): Promise<IndexArtifact> {
  const artifact = JSON.parse(await readFile(path, "utf8")) as IndexArtifact;
  if (artifact.version !== 1) {
    throw new Error(`unsupported index artifact version: ${artifact.version}`);
  }
  return artifact;
}
