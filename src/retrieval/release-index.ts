import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  gatewayEmbedder,
} from "./embedder.js";
import { embeddingInput } from "./index-builder.js";
import { splitPassages } from "./passage-splitter.js";
import { loadManifest } from "./manifest-loader.js";
import { InMemoryVectorStore } from "./vector-store.js";
import type { Embedder, EmbeddedDoc, WikiDoc } from "./types.js";

// Consume the index INGESTION emits at release (impel-ingestion writes
// wiki/_meta/index.json; see its agent/lib/stores/release-index.ts). This is the
// read side of the shared seam — the one path that turns the released index into a
// queryable store, so retrieval answers over the real wiki without owning the build.
//
// Two ways it differs from next's own IndexArtifact (index-store.ts), and both are
// handled here:
//   1. A doc's `embedding` may be ABSENT — embedding is best-effort at release, so a
//      gateway outage there ships the index with content/section/links but no vector.
//      We backfill the gaps on load.
//   2. Each doc carries a `contentHash` (ingestion's carry-forward key) we don't need.
//
// As of v2, we first try to load a slim manifest (wiki/_meta/index/manifest.json) with
// lazy-loaded content and passage vectors. If it doesn't exist, we fall back to the
// legacy index.json path.

export const RELEASE_INDEX_PATH = "wiki/_meta/index.json";
export const RELEASE_INDEX_V2_PATH = "wiki/_meta/index/manifest.json";

// A doc as it appears in the emitted index: a WikiDoc plus ingestion's contentHash,
// with `embedding` optional (best-effort at release).
export type ReleaseIndexDoc = WikiDoc & {
  contentHash?: string;
  embedding?: number[];
};

export type ReleaseIndex = {
  version: 1;
  model: string;
  dimensions: number;
  docs: ReleaseIndexDoc[];
};

export type LoadStats = {
  total: number;
  carried: number; // docs that arrived with an embedding
  backfilled: number; // docs we embedded on load
  format: "v1" | "v2"; // whether we loaded v1 index.json or v2 manifest
};

export function parseReleaseIndex(json: string): ReleaseIndex {
  const index = JSON.parse(json) as ReleaseIndex;
  if (index.version !== 1) {
    throw new Error(`unsupported release index version: ${index.version}`);
  }
  if (!Array.isArray(index.docs)) {
    throw new Error("release index has no docs[]");
  }
  return index;
}

// Resolve v2 manifest path from v1 index path
function resolveV2ManifestPath(v1IndexPath: string): string {
  const dir = dirname(v1IndexPath);
  return join(dir, "manifest.json");
}

// Load from v2 manifest: pages with lazy-loaded content and passage vectors
async function loadV2Manifest(opts: {
  manifestPath: string;
  embedder?: Embedder;
}): Promise<{
  store: InMemoryVectorStore;
  docs: EmbeddedDoc[];
  embedder: Embedder;
  stats: LoadStats;
}> {
  const loader = await loadManifest({
    manifestPath: opts.manifestPath,
  });

  const model = loader.manifest.model;
  const dimensions = loader.manifest.dimensions;

  if (model !== EMBEDDING_MODEL || dimensions !== EMBEDDING_DIMENSIONS) {
    console.warn(
      `[release-index] v2 manifest embedding ${model}@${dimensions} ` +
        `differs from retrieval default ${EMBEDDING_MODEL}@${EMBEDDING_DIMENSIONS} — ` +
        `querying in the manifest's space`
    );
  }

  const embedder =
    opts.embedder ?? gatewayEmbedder({ model, dimensions });

  // Load all page docs
  const pageDocs = await loader.toPageDocs();

  // Load passage vectors from sidecars and build passage entries
  const passages: Array<{
    pageId: string;
    index: number;
    text: string;
    embedding: number[];
  }> = [];

  const embeddedDocs: EmbeddedDoc[] = [];
  let carried = 0;
  let backfilled = 0;

  for (const pageDoc of pageDocs) {
    const pagePassageTexts = splitPassages(pageDoc.content);

    // Try to load passage vectors from sidecar
    let vectors: number[][] | null = null;
    try {
      vectors = await loader.getPassageVectors(pageDoc.path);
    } catch {
      // Sidecar missing or unreadable; we'll backfill
    }

    let firstPassageEmbedding: number[];

    if (vectors && vectors.length === pagePassageTexts.length) {
      // Sidecar vectors match the split — use them
      for (let i = 0; i < pagePassageTexts.length; i++) {
        passages.push({
          pageId: pageDoc.path,
          index: i,
          text: pagePassageTexts[i],
          embedding: vectors[i],
        });
        carried++;
      }
      firstPassageEmbedding = vectors[0];
    } else {
      // No matching sidecar — backfill vectors for all passages
      const textsToEmbed = pagePassageTexts;
      const embeddedVectors = await embedder(textsToEmbed);
      for (let i = 0; i < pagePassageTexts.length; i++) {
        passages.push({
          pageId: pageDoc.path,
          index: i,
          text: pagePassageTexts[i],
          embedding: embeddedVectors[i],
        });
        backfilled++;
      }
      firstPassageEmbedding = embeddedVectors[0];
    }

    // Convert to EmbeddedDoc (use first passage embedding as page embedding)
    embeddedDocs.push({
      ...pageDoc,
      embedding: firstPassageEmbedding,
    });
  }

  // Store page-level docs and passage-level vectors
  const store = new InMemoryVectorStore();
  await store.upsert(embeddedDocs);
  await store.upsertPassages(passages);

  return {
    store,
    docs: embeddedDocs,
    embedder,
    stats: {
      total: pageDocs.length,
      carried,
      backfilled,
      format: "v2",
    },
  };
}

// Load from v1 index.json (legacy)
async function loadV1Index(opts: {
  path: string;
  embedder?: Embedder;
}): Promise<{
  store: InMemoryVectorStore;
  docs: EmbeddedDoc[];
  embedder: Embedder;
  stats: LoadStats;
}> {
  const index = parseReleaseIndex(await readFile(opts.path, "utf8"));

  if (
    index.model !== EMBEDDING_MODEL ||
    index.dimensions !== EMBEDDING_DIMENSIONS
  ) {
    console.warn(
      `[release-index] index embedding ${index.model}@${index.dimensions} ` +
        `differs from retrieval default ${EMBEDDING_MODEL}@${EMBEDDING_DIMENSIONS} — ` +
        `querying in the index's space`
    );
  }

  const embedder =
    opts.embedder ??
    gatewayEmbedder({ model: index.model, dimensions: index.dimensions });

  const carried: EmbeddedDoc[] = [];
  const missing: ReleaseIndexDoc[] = [];
  for (const doc of index.docs) {
    if (doc.embedding && doc.embedding.length > 0) {
      carried.push(stripToEmbedded(doc, doc.embedding));
    } else {
      missing.push(doc);
    }
  }

  const backfilled: EmbeddedDoc[] = [];
  if (missing.length > 0) {
    const vectors = await embedder(missing.map(embeddingInput));
    missing.forEach((doc, i) =>
      backfilled.push(stripToEmbedded(doc, vectors[i]))
    );
  }

  const docs = [...carried, ...backfilled];

  // For v1, treat each page as a single passage
  const passages: Array<{
    pageId: string;
    index: number;
    text: string;
    embedding: number[];
  }> = [];
  for (const doc of docs) {
    passages.push({
      pageId: doc.path,
      index: 0,
      text: doc.content,
      embedding: doc.embedding,
    });
  }

  const store = new InMemoryVectorStore();
  await store.upsert(docs);
  await store.upsertPassages(passages);

  return {
    store,
    docs,
    embedder,
    stats: {
      total: index.docs.length,
      carried: carried.length,
      backfilled: backfilled.length,
      format: "v1",
    },
  };
}

// Load the emitted index into a queryable store. First tries v2 manifest,
// then falls back to v1 index.json. Docs that arrived with an embedding are
// used as-is; docs missing one are embedded NOW — and crucially with the same
// model + dimensions the index records, so the backfilled vectors land in the
// same space as the carried ones. The returned `embedder` is that same
// index-pinned embedder: pass it to the strategy so the QUERY is embedded in
// that space too, or the rankings are garbage (the one mechanical rule of this seam).
//
// Pass your own `embedder` only in tests/offline; production should let it default
// so the space always follows the index, not retrieval's constants.
export async function loadReleaseIndex(opts: {
  path: string;
  embedder?: Embedder;
}): Promise<{
  store: InMemoryVectorStore;
  docs: EmbeddedDoc[];
  embedder: Embedder;
  stats: LoadStats;
}> {
  // Try v2 manifest first
  const v2Path = resolveV2ManifestPath(opts.path);
  try {
    // Check if v2 manifest exists
    await readFile(v2Path);
    console.log(`[release-index] loading v2 manifest from ${v2Path}`);
    return await loadV2Manifest({
      manifestPath: v2Path,
      embedder: opts.embedder,
    });
  } catch (e) {
    // Manifest doesn't exist or is unreadable; fall back to v1
    if (
      (e as NodeJS.ErrnoException).code !== "ENOENT" &&
      (e as NodeJS.ErrnoException).code !== "ENOTDIR"
    ) {
      // Some other error (permission denied, etc.) — log it but still try v1
      console.warn(`[release-index] error reading v2 manifest: ${e}`);
    }
  }

  console.log(`[release-index] loading v1 index from ${opts.path}`);
  return await loadV1Index({
    path: opts.path,
    embedder: opts.embedder,
  });
}

// Drop ingestion-only fields (contentHash) and pin the embedding, yielding the
// EmbeddedDoc the store and strategies expect.
function stripToEmbedded(doc: ReleaseIndexDoc, embedding: number[]): EmbeddedDoc {
  return {
    path: doc.path,
    title: doc.title,
    content: doc.content,
    vault: doc.vault,
    section: doc.section,
    tags: doc.tags,
    links: doc.links,
    pinned: doc.pinned,
    embedding,
  };
}
