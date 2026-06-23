import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex } from "./index-builder.js";
import { InMemoryVectorStore } from "./vector-store.js";
import { compareStrategies } from "./eval.js";
import type { Embedder, WikiDoc } from "./types.js";

// Same deterministic, offline embedder as retrieval.test.ts: token-overlap cosine,
// no network. Keeps the eval comparison reproducible.
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
    content: "A bond pays periodic interest called a coupon until maturity.",
  },
  {
    path: "marketing/brand.md",
    title: "Brand voice",
    content: "Our brand voice is warm and direct across every campaign.",
  },
];

// Build the shared store the way the harness now expects it passed in. One embedder
// instance embeds both the docs (here) and the queries (inside compareStrategies),
// so doc and query vectors share a space.
async function buildStore(embedder: Embedder) {
  return buildIndex({ docs, embedder, store: new InMemoryVectorStore() });
}

test("compareStrategies reports one row per strategy with sane metrics", async () => {
  const embedder = fakeEmbedder();
  const reports = await compareStrategies({
    store: await buildStore(embedder),
    docs,
    embedder,
    queries: [
      { query: "bond coupon interest", expectedPath: "finance/bonds.md" },
      { query: "brand voice campaign", expectedPath: "marketing/brand.md" },
    ],
    strategies: ["flat-embed", "hybrid-rrf", "section-aware"],
  });

  assert.equal(reports.length, 3);
  for (const report of reports) {
    assert.equal(report.n, 2);
    assert.equal(report.outOfCorpus, 0);
    assert.ok(report.hitAt1 >= 0 && report.hitAt1 <= 1);
    assert.ok(report.hitAt5 >= 0 && report.hitAt5 <= 1);
    assert.ok(report.mrr >= 0 && report.mrr <= 1);
  }

  // hybrid-rrf should land the right page first for these term-overlapping queries.
  const hybrid = reports.find((r) => r.strategy === "hybrid-rrf");
  assert.ok(hybrid);
  assert.equal(hybrid?.hitAt1, 1);
});

test("out-of-corpus queries score abstain rate, not ranking", async () => {
  const embedder = fakeEmbedder();
  const [report] = await compareStrategies({
    store: await buildStore(embedder),
    docs,
    embedder,
    queries: [
      { query: "bond coupon interest", expectedPath: "finance/bonds.md" },
      // Out of corpus: scoped to a vault nothing lives in, so retrieval returns no
      // chunks and the evidence gate must abstain — independent of any score.
      { query: "anything at all", scope: { vault: "does-not-exist" } },
    ],
    strategies: ["flat-embed"],
  });

  assert.ok(report);
  assert.equal(report.n, 1); // only the in-corpus query is ranked
  assert.equal(report.outOfCorpus, 1);
  assert.equal(report.abstainRate, 1); // empty result -> gate fires
});
