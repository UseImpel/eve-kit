import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex } from "./index-builder.js";
import { InMemoryVectorStore } from "./vector-store.js";
import { evidenceGate } from "./evidence-gate.js";
import { FlatEmbedStrategy } from "./strategies/flat-embed.js";
import { HybridRrfStrategy } from "./strategies/hybrid-rrf.js";
// Deterministic, offline embedder: hash tokens into a fixed-width vector so cosine
// reflects token overlap. Lets the pipeline be tested end-to-end without a network
// call or an API key — the real gateway embedder is swapped in at runtime.
function fakeEmbedder(dims = 64) {
    return async (texts) => texts.map((text) => {
        const v = new Array(dims).fill(0);
        for (const token of text
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter(Boolean)) {
            let h = 0;
            for (const ch of token)
                h = (h * 31 + ch.charCodeAt(0)) % dims;
            v[h] += 1;
        }
        return v;
    });
}
const docs = [
    {
        path: "finance/bonds.md",
        title: "Bonds",
        content: "A bond pays periodic interest called a coupon until maturity.",
        vault: "vault-a",
    },
    {
        path: "marketing/brand.md",
        title: "Brand voice",
        content: "Our brand voice is warm and direct across every campaign.",
        vault: "vault-a",
    },
    {
        path: "ops/onboarding.md",
        title: "Onboarding",
        content: "New scholars complete onboarding before the first cohort week.",
        vault: "vault-b",
    },
];
async function deps() {
    const embedder = fakeEmbedder();
    const store = await buildIndex({
        docs,
        embedder,
        store: new InMemoryVectorStore(),
    });
    return { embedder, store, docs };
}
test("flat-embed ranks the topically-right page first", async () => {
    const strategy = new FlatEmbedStrategy(await deps());
    const result = await strategy.retrieve({
        query: "how does bond coupon interest work",
    });
    assert.equal(result.strategy, "flat-embed");
    assert.equal(result.chunks[0]?.path, "finance/bonds.md");
    assert.ok(result.confidence > 0 && result.confidence <= 1);
});
test("hybrid-rrf ranks the topically-right page first", async () => {
    const strategy = new HybridRrfStrategy(await deps());
    const result = await strategy.retrieve({
        query: "how does bond coupon interest work",
    });
    assert.equal(result.strategy, "hybrid-rrf");
    assert.equal(result.chunks[0]?.path, "finance/bonds.md");
});
test("scope filters to a single vault (both strategies)", async () => {
    const shared = await deps();
    for (const strategy of [
        new FlatEmbedStrategy(shared),
        new HybridRrfStrategy(shared),
    ]) {
        const result = await strategy.retrieve({
            query: "onboarding cohort",
            scope: { vault: "vault-a" },
        });
        assert.ok(result.chunks.every((c) => c.vault === "vault-a"));
    }
});
test("k bounds the number of results", async () => {
    const strategy = new FlatEmbedStrategy(await deps());
    const result = await strategy.retrieve({ query: "interest", k: 1 });
    assert.equal(result.chunks.length, 1);
});
test("evidence gate abstains with no results or low confidence", () => {
    const empty = {
        chunks: [],
        confidence: 0,
        strategy: "flat-embed",
    };
    assert.deepEqual(evidenceGate(empty), {
        gated: true,
        reason: "no_results",
    });
    const weak = {
        chunks: [{ path: "a", title: "A", score: 0.2, snippet: "" }],
        confidence: 0.1,
        strategy: "flat-embed",
    };
    assert.deepEqual(evidenceGate(weak), {
        gated: true,
        reason: "low_confidence",
    });
    const strong = {
        chunks: [{ path: "a", title: "A", score: 0.9, snippet: "" }],
        confidence: 0.9,
        strategy: "flat-embed",
    };
    assert.deepEqual(evidenceGate(strong), { gated: false });
});
test("vector store supports passage-level queries with page deduplication", async () => {
    const store = new InMemoryVectorStore();
    const embedder = fakeEmbedder();
    // Upsert page-level docs
    await store.upsert(docs.map((doc) => ({
        ...doc,
        embedding: new Array(64).fill(0), // dummy
    })));
    // Upsert passages: bonds has 2 passages, brand has 1, onboarding has 1
    const bondPassages = [
        "A bond pays periodic interest called a coupon until maturity. Bond coupon.",
        "More about bonds and their features.",
    ];
    const brandPassages = [
        "Our brand voice is warm and direct across every campaign.",
    ];
    const onboardingPassages = [
        "New scholars complete onboarding before the first cohort week.",
    ];
    const allPassageTexts = [
        ...bondPassages,
        ...brandPassages,
        ...onboardingPassages,
    ];
    const vectors = await embedder(allPassageTexts);
    let vectorIdx = 0;
    const passages = [
        ...bondPassages.map((text, i) => ({
            pageId: "finance/bonds.md",
            index: i,
            text,
            embedding: vectors[vectorIdx++],
        })),
        ...brandPassages.map((text, i) => ({
            pageId: "marketing/brand.md",
            index: i,
            text,
            embedding: vectors[vectorIdx++],
        })),
        ...onboardingPassages.map((text, i) => ({
            pageId: "ops/onboarding.md",
            index: i,
            text,
            embedding: vectors[vectorIdx++],
        })),
    ];
    await store.upsertPassages(passages);
    // Query for "bond interest" should find the bonds page (best passage match)
    const [queryVec] = await embedder(["bond interest"]);
    const results = await store.query({
        embedding: queryVec,
        k: 3,
    });
    // Results should be deduplicated to pages
    const resultPaths = results.map((c) => c.path);
    assert.ok(new Set(resultPaths).size === resultPaths.length, "Each page should appear at most once");
    // Bonds should rank high (has multiple passages matching query terms)
    assert.ok(resultPaths.includes("finance/bonds.md"));
    // Snippets should be passage text, not page text
    const bondsResult = results.find((r) => r.path === "finance/bonds.md");
    assert.ok(bondsResult && bondsResult.snippet.includes("coupon"), "Snippet should be passage text");
});
//# sourceMappingURL=retrieval.test.js.map