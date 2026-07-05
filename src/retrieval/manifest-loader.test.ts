import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadManifest } from "./manifest-loader.js";

test("loadManifest: loads v2 manifest and lazy-loads content", async () => {
  // Create a temporary directory structure
  const tempDir = await mkdtemp(join(tmpdir(), "manifest-test-"));
  const pagesDir = join(tempDir, "pages");
  const vectorsDir = join(tempDir, "vectors");

  // Create necessary directories
  await mkdir(join(pagesDir, "finance"), { recursive: true });
  await mkdir(join(pagesDir, "ops"), { recursive: true });
  await mkdir(join(vectorsDir, "finance"), { recursive: true });
  await mkdir(join(vectorsDir, "ops"), { recursive: true });

  // Write manifest
  const manifest = {
    version: 2,
    model: "openai/text-embedding-3-large",
    dimensions: 1536,
    pages: [
      {
        path: "finance/bonds.md",
        title: "Bonds",
        vault: "vault-a",
      },
      {
        path: "ops/onboarding.md",
        title: "Onboarding",
        vault: "vault-b",
      },
    ],
  };

  const manifestPath = join(tempDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest));

  // Write page content
  const bondsContent = "A bond pays periodic interest.";
  await writeFile(join(pagesDir, "finance", "bonds.md"), bondsContent);

  const onboardingContent = "New scholars complete onboarding.";
  await writeFile(join(pagesDir, "ops", "onboarding.md"), onboardingContent);

  // Write passage vectors
  const bondsVectors = [[0.1, 0.2, 0.3]];
  await writeFile(
    join(vectorsDir, "finance", "bonds.md.json"),
    JSON.stringify(bondsVectors)
  );

  const onboardingVectors = [[0.4, 0.5, 0.6]];
  await writeFile(
    join(vectorsDir, "ops", "onboarding.md.json"),
    JSON.stringify(onboardingVectors)
  );

  // Load the manifest
  const loader = await loadManifest({
    manifestPath,
    baseDir: tempDir,
  });

  // Check manifest was loaded
  assert.equal(loader.manifest.version, 2);
  assert.equal(loader.manifest.pages.length, 2);
  assert.equal(loader.manifest.model, "openai/text-embedding-3-large");

  // Check lazy-loading of content
  const bonds = await loader.getPageContent("finance/bonds.md");
  assert.equal(bonds, bondsContent);

  // Check lazy-loading of vectors
  const bondsVecs = await loader.getPassageVectors("finance/bonds.md");
  assert.deepEqual(bondsVecs, bondsVectors);

  // Check caching (should not re-read from disk)
  const bondsAgain = await loader.getPageContent("finance/bonds.md");
  assert.equal(bondsAgain, bondsContent);

  // Check toPageDocs
  const docs = await loader.toPageDocs();
  assert.equal(docs.length, 2);
  assert.equal(docs[0].title, "Bonds");
  assert.equal(docs[0].vault, "vault-a");
  assert.equal(docs[0].content, bondsContent);
});

test("loadManifest: rejects wrong version", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "manifest-test-"));
  const manifest = {
    version: 1,
    pages: [],
  };

  const manifestPath = join(tempDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest));

  try {
    await loadManifest({ manifestPath, baseDir: tempDir });
    assert.fail("Should reject version 1");
  } catch (e) {
    assert((e as Error).message.includes("Unsupported manifest version"));
  }
});
