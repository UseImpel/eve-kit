import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { embedDocs } from "./index-builder.js";
import {
  loadIndex,
  saveIndex,
  serializeIndex,
  storeFromArtifact,
} from "./index-store.js";
import { loadWikiDir } from "./load-wiki.js";
import { FlatEmbedStrategy } from "./strategies/flat-embed.js";
import type { Embedder, WikiDoc } from "./types.js";

function fakeEmbedder(dims = 64): Embedder {
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

const docs: WikiDoc[] = [
  {
    path: "finance/bonds.md",
    title: "Bonds",
    content: "A bond pays a coupon.",
  },
  {
    path: "marketing/brand.md",
    title: "Brand",
    content: "Brand voice is warm.",
  },
];

test("index artifact round-trips through disk and serves queries", async () => {
  const embedder = fakeEmbedder();
  const embedded = await embedDocs(docs, embedder);
  const dir = await mkdtemp(join(tmpdir(), "ret-index-"));
  const out = join(dir, "index.json");
  try {
    await saveIndex(out, serializeIndex(embedded));
    const artifact = await loadIndex(out);
    assert.equal(artifact.version, 1);
    assert.equal(artifact.docs.length, 2);

    const store = await storeFromArtifact(artifact);
    const result = await new FlatEmbedStrategy({ embedder, store }).retrieve({
      query: "bond coupon",
    });
    assert.equal(result.chunks[0]?.path, "finance/bonds.md");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadWikiDir derives section from folder and links from wikilinks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ret-wiki-"));
  try {
    await mkdir(join(dir, "finance"), { recursive: true });
    await writeFile(
      join(dir, "finance", "bonds.md"),
      "# Bonds\n\nSee [[Coupons]] and [[Rates|interest rates]]."
    );
    const [doc] = await loadWikiDir(dir);
    assert.equal(doc?.section, "finance");
    assert.deepEqual(doc?.links, ["Coupons", "Rates"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
