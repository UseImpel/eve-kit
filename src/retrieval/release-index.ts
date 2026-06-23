import { readFile } from "node:fs/promises";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  gatewayEmbedder,
} from "./embedder.js";
import { embeddingInput } from "./index-builder.js";
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

export const RELEASE_INDEX_PATH = "wiki/_meta/index.json";

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

// Load the emitted index into a queryable store. Docs that arrived with an
// embedding are used as-is; docs missing one are embedded NOW — and crucially with
// the same model + dimensions the index records, so the backfilled vectors land in
// the same space as the carried ones. The returned `embedder` is that same
// index-pinned embedder: pass it to the strategy so the QUERY is embedded in that
// space too, or the rankings are garbage (the one mechanical rule of this seam).
//
// Pass your own `embedder` only in tests/offline; production should let it default
// so the space always follows the index, not next's constants.
export async function loadReleaseIndex(opts: {
  path: string;
  embedder?: Embedder;
}): Promise<{
  store: InMemoryVectorStore;
  docs: EmbeddedDoc[];
  embedder: Embedder;
  stats: LoadStats;
}> {
  const index = parseReleaseIndex(await readFile(opts.path, "utf8"));

  if (index.model !== EMBEDDING_MODEL || index.dimensions !== EMBEDDING_DIMENSIONS) {
    // Not fatal — we honor the index's own space — but a drift worth surfacing,
    // since ingestion and retrieval are supposed to share one embedding contract.
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
    missing.forEach((doc, i) => backfilled.push(stripToEmbedded(doc, vectors[i])));
  }

  const docs = [...carried, ...backfilled];
  const store = new InMemoryVectorStore();
  await store.upsert(docs);

  return {
    store,
    docs,
    embedder,
    stats: { total: index.docs.length, carried: carried.length, backfilled: backfilled.length },
  };
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
