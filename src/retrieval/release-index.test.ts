import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./embedder.js";
import { serializeSidecar, sidecarFileName } from "./embedding-sidecar.js";
import { loadReleaseIndex, RELEASE_INDEX_V2_PATH } from "./release-index.js";
import { FlatEmbedStrategy } from "./strategies/flat-embed.js";
import type { Embedder } from "./types.js";

// Same token-hash fake as the other retrieval tests, sized to the real contract
// dims so the loaded release matches EMBEDDING_DIMENSIONS (no drift warning).
function fakeEmbedder(dims = EMBEDDING_DIMENSIONS): Embedder {
  return async (texts) =>
    texts.map((text) => {
      const v = new Array<number>(dims).fill(0);
      for (const token of text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)) {
        let h = 0;
        for (const ch of token) h = (h * 31 + ch.charCodeAt(0)) % dims;
        v[h] += 1;
      }
      return v;
    });
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// Emit the release artifact in ingestion's REAL layout: pages in the wiki tree,
// the v2 manifest at wiki/_meta/index/manifest.json, and binary passage-vector
// sidecars keyed by contentHash. Bonds ships WITH a sidecar (carried), brand
// WITHOUT one (the best-effort gateway gap retrieval must backfill).
async function writeEmittedVault(root: string): Promise<string> {
  const embed = fakeEmbedder();
  const bondsContent = "A bond pays a coupon.";
  const brandContent = "Brand voice is warm.";
  const bondsHash = sha256(bondsContent);

  await mkdir(join(root, "wiki", "finance"), { recursive: true });
  await mkdir(join(root, "wiki", "marketing"), { recursive: true });
  await writeFile(join(root, "wiki", "finance", "bonds.md"), bondsContent);
  await writeFile(join(root, "wiki", "marketing", "brand.md"), brandContent);

  const [bondsVec] = await embed([`Bonds\n\n${bondsContent}`]);
  const sidecarRel = sidecarFileName(
    bondsHash,
    EMBEDDING_MODEL,
    EMBEDDING_DIMENSIONS
  );
  const sidecarAbs = join(root, "wiki", "_meta", "embeddings", sidecarRel);
  await mkdir(dirname(sidecarAbs), { recursive: true });
  await writeFile(
    sidecarAbs,
    serializeSidecar({
      manifest: {
        modelId: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        passageCount: 1,
        passages: [{ index: 0, charOffset: 0, charLength: bondsContent.length }],
      },
      vectors: [bondsVec],
    })
  );

  const manifestPath = join(root, RELEASE_INDEX_V2_PATH);
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      version: 2,
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      // `docs` only, no `pages` mirror — the shape older manifests actually
      // have on disk; the loader must not require the mirror.
      docs: [
        {
          path: "wiki/finance/bonds.md",
          title: "Bonds",
          section: "finance",
          contentHash: bondsHash,
        },
        {
          path: "wiki/marketing/brand.md",
          title: "Brand",
          section: "marketing",
          pinned: true,
          contentHash: sha256(brandContent),
          // Unknown producer-declared field — must ride along harmlessly.
          reviewedBy: "someone",
        },
      ],
    })
  );
  return manifestPath;
}

test("loadReleaseIndex reads the real layout: sidecar carried, missing sidecar backfilled", async () => {
  const root = await mkdtemp(join(tmpdir(), "release-manifest-"));
  try {
    const manifestPath = await writeEmittedVault(root);
    const embedder = fakeEmbedder();
    const { store, docs, stats } = await loadReleaseIndex({
      path: manifestPath,
      embedder,
    });

    assert.equal(stats.total, 2);
    assert.equal(stats.format, "v2");
    assert.equal(stats.carried, 1); // bonds' passage came from its sidecar
    assert.equal(stats.backfilled, 1); // brand had no sidecar — embedded on load
    assert.equal(store.size(), 2);
    assert.ok(docs.every((d) => d.embedding.length === EMBEDDING_DIMENSIONS));

    // Same space for carried + backfilled + query → rankings are meaningful.
    const result = await new FlatEmbedStrategy({ embedder, store }).retrieve({
      query: "bond coupon",
    });
    assert.equal(result.chunks[0]?.path, "wiki/finance/bonds.md");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("loadReleaseIndex preserves section + pinned from the manifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "release-manifest-"));
  try {
    const manifestPath = await writeEmittedVault(root);
    const { docs } = await loadReleaseIndex({
      path: manifestPath,
      embedder: fakeEmbedder(),
    });
    const brand = docs.find((d) => d.path === "wiki/marketing/brand.md");
    assert.equal(brand?.section, "marketing");
    assert.equal(brand?.pinned, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("loadReleaseIndex maps a legacy index.json path to the manifest beside it", async () => {
  const root = await mkdtemp(join(tmpdir(), "release-manifest-"));
  try {
    await writeEmittedVault(root);
    // Callers still configured with the retired path must land on the manifest,
    // never on the frozen file itself.
    const { stats } = await loadReleaseIndex({
      path: join(root, "wiki", "_meta", "index.json"),
      embedder: fakeEmbedder(),
    });
    assert.equal(stats.total, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("loadReleaseIndex hard-errors on a missing manifest — no fallback to index.json", async () => {
  const root = await mkdtemp(join(tmpdir(), "release-manifest-"));
  try {
    // A frozen index.json is present, the manifest is not: the load must FAIL,
    // not quietly serve the frozen corpus.
    await mkdir(join(root, "wiki", "_meta"), { recursive: true });
    await writeFile(
      join(root, "wiki", "_meta", "index.json"),
      JSON.stringify({ version: 1, docs: [] })
    );
    await assert.rejects(
      loadReleaseIndex({
        path: join(root, RELEASE_INDEX_V2_PATH),
        embedder: fakeEmbedder(),
      }),
      /manifest v2 not found/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("loadReleaseIndex hard-errors on a corrupt manifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "release-manifest-"));
  try {
    const manifestPath = await writeEmittedVault(root);
    await writeFile(manifestPath, "{ not json");
    await assert.rejects(
      loadReleaseIndex({ path: manifestPath, embedder: fakeEmbedder() }),
      /unreadable/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("loadReleaseIndex backfills when page content drifted from its contentHash", async () => {
  const root = await mkdtemp(join(tmpdir(), "release-manifest-"));
  try {
    const manifestPath = await writeEmittedVault(root);
    // Edit bonds AFTER its sidecar was written: the sidecar's vectors describe
    // text that no longer exists, so they must be ignored and re-embedded.
    await writeFile(
      join(root, "wiki", "finance", "bonds.md"),
      "A bond pays a coupon. Yields move inversely to price."
    );
    const { stats } = await loadReleaseIndex({
      path: manifestPath,
      embedder: fakeEmbedder(),
    });
    assert.equal(stats.carried, 0);
    assert.equal(stats.backfilled, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
