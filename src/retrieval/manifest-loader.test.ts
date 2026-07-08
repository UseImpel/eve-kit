import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { serializeSidecar, sidecarFileName } from "./embedding-sidecar.js";
import { loadManifest } from "./manifest-loader.js";

const MODEL = "openai/text-embedding-3-large";
const DIMS = 3; // tiny vectors — the loader never checks against retrieval's contract dims

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// Emit ingestion's REAL layout into a temp wiki-repo root: pages in the wiki
// tree, manifest at wiki/_meta/index/manifest.json, binary sidecars keyed by
// contentHash under wiki/_meta/embeddings/.
async function writeVault(root: string): Promise<string> {
  const bondsContent = "A bond pays periodic interest.";
  const onboardingContent = "New scholars complete onboarding.";
  const bondsHash = sha256(bondsContent);

  await mkdir(join(root, "wiki", "finance"), { recursive: true });
  await mkdir(join(root, "wiki", "ops"), { recursive: true });
  await writeFile(join(root, "wiki", "finance", "bonds.md"), bondsContent);
  await writeFile(join(root, "wiki", "ops", "onboarding.md"), onboardingContent);

  const sidecarAbs = join(
    root,
    "wiki",
    "_meta",
    "embeddings",
    sidecarFileName(bondsHash, MODEL, DIMS)
  );
  await mkdir(dirname(sidecarAbs), { recursive: true });
  await writeFile(
    sidecarAbs,
    serializeSidecar({
      manifest: {
        modelId: MODEL,
        dimensions: DIMS,
        passageCount: 1,
        passages: [{ index: 0, charOffset: 0, charLength: bondsContent.length }],
      },
      vectors: [[0.1, 0.2, 0.3]],
    })
  );

  const manifestPath = join(root, "wiki", "_meta", "index", "manifest.json");
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      version: 2,
      model: MODEL,
      dimensions: DIMS,
      pages: [
        {
          path: "wiki/finance/bonds.md",
          title: "Bonds",
          vault: "vault-a",
          contentHash: bondsHash,
        },
        {
          path: "wiki/ops/onboarding.md",
          title: "Onboarding",
          vault: "vault-b",
          // no contentHash — no sidecar to find; getPagePassages returns null
        },
      ],
    })
  );
  return manifestPath;
}

test("loadManifest: loads the real layout, lazy content + sidecar passages", async () => {
  const root = await mkdtemp(join(tmpdir(), "manifest-test-"));
  const manifestPath = await writeVault(root);

  // baseDir deliberately omitted — must be derived from the manifest path.
  const loader = await loadManifest({ manifestPath });

  assert.equal(loader.manifest.version, 2);
  assert.equal(loader.manifest.pages.length, 2);
  assert.equal(loader.manifest.model, MODEL);

  const bonds = await loader.getPageContent("wiki/finance/bonds.md");
  assert.equal(bonds, "A bond pays periodic interest.");

  const passages = await loader.getPagePassages("wiki/finance/bonds.md");
  assert.ok(passages);
  assert.deepEqual(passages.texts, ["A bond pays periodic interest."]);
  assert.equal(passages.vectors.length, 1);
  assert.ok(Math.abs(passages.vectors[0][1] - 0.2) < 1e-6);

  // No contentHash → no sidecar → null (caller backfills), not a throw.
  const onboarding = await loader.getPagePassages("wiki/ops/onboarding.md");
  assert.equal(onboarding, null);

  const docs = await loader.toPageDocs();
  assert.equal(docs.length, 2);
  assert.equal(docs[0].title, "Bonds");
  assert.equal(docs[0].vault, "vault-a");
});

test("loadManifest: accepts entries under docs when the pages mirror is absent", async () => {
  const root = await mkdtemp(join(tmpdir(), "manifest-test-"));
  const manifestPath = await writeVault(root);
  const raw = JSON.parse(
    await (await import("node:fs/promises")).readFile(manifestPath, "utf8")
  );
  await writeFile(
    manifestPath,
    JSON.stringify({ ...raw, docs: raw.pages, pages: undefined })
  );

  const loader = await loadManifest({ manifestPath });
  assert.equal(loader.manifest.pages.length, 2);
});

test("loadManifest: throws loudly on a missing manifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "manifest-test-"));
  await assert.rejects(
    loadManifest({
      manifestPath: join(root, "wiki", "_meta", "index", "manifest.json"),
    }),
    /manifest v2 not found/
  );
});

test("loadManifest: rejects wrong version", async () => {
  const root = await mkdtemp(join(tmpdir(), "manifest-test-"));
  const manifestPath = join(root, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({ version: 1, pages: [] }));
  await assert.rejects(
    loadManifest({ manifestPath, baseDir: root }),
    /unsupported manifest version/
  );
});

test("loadManifest: reads a sidecar stored as base64 text", async () => {
  const root = await mkdtemp(join(tmpdir(), "manifest-test-"));
  const manifestPath = await writeVault(root);
  // Sidecars written through the GitHub tree API's `content` field landed as
  // base64 TEXT, not binary — the loader must decode them transparently.
  const fs = await import("node:fs/promises");
  const sidecarAbs = join(
    root,
    "wiki",
    "_meta",
    "embeddings",
    sidecarFileName(sha256("A bond pays periodic interest."), MODEL, DIMS)
  );
  const binary = await fs.readFile(sidecarAbs);
  await fs.writeFile(sidecarAbs, binary.toString("base64"));

  const loader = await loadManifest({ manifestPath });
  const passages = await loader.getPagePassages("wiki/finance/bonds.md");
  assert.ok(passages);
  assert.ok(Math.abs(passages.vectors[0][1] - 0.2) < 1e-6);
});

test("loadManifest: prefers docs over a stale pages mirror", async () => {
  const root = await mkdtemp(join(tmpdir(), "manifest-test-"));
  const manifestPath = await writeVault(root);
  const fs = await import("node:fs/promises");
  const raw = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  // A manifest written before the serializer re-mirrored on every release:
  // `pages` still shows an old hash while `docs` is current.
  await fs.writeFile(
    manifestPath,
    JSON.stringify({
      ...raw,
      docs: raw.pages,
      pages: raw.pages.map((p: { contentHash?: string }) => ({
        ...p,
        contentHash: p.contentHash ? "0".repeat(64) : undefined,
      })),
    })
  );

  const loader = await loadManifest({ manifestPath });
  // Reading the stale mirror would fail the hash check and drop the sidecar.
  const passages = await loader.getPagePassages("wiki/finance/bonds.md");
  assert.ok(passages);
});

test("loadManifest: skips a page listed in the manifest but missing on disk", async () => {
  const root = await mkdtemp(join(tmpdir(), "manifest-test-"));
  const manifestPath = await writeVault(root);
  await (await import("node:fs/promises")).rm(
    join(root, "wiki", "ops", "onboarding.md")
  );

  const loader = await loadManifest({ manifestPath });
  const docs = await loader.toPageDocs();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].path, "wiki/finance/bonds.md");
});
