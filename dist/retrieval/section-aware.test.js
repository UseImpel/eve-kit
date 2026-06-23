import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex } from "./index-builder.js";
import { InMemoryVectorStore } from "./vector-store.js";
import { HybridRrfStrategy } from "./strategies/hybrid-rrf.js";
import { SectionAwareStrategy } from "./strategies/section-aware.js";
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
async function strategies(docs) {
    const embedder = fakeEmbedder();
    const store = await buildIndex({
        docs,
        embedder,
        store: new InMemoryVectorStore(),
    });
    return {
        hybrid: new HybridRrfStrategy({ embedder, store, docs }),
        sectionAware: new SectionAwareStrategy({ embedder, store, docs }),
    };
}
test("backlink expansion surfaces a linked page that hybrid alone drops", async () => {
    const docs = [
        {
            path: "guide.md",
            title: "Bonds Guide",
            content: "All about bonds.",
            links: ["Coupon"],
        },
        { path: "d1.md", title: "D1", content: "unrelated one" },
        { path: "d2.md", title: "D2", content: "unrelated two" },
        { path: "d3.md", title: "D3", content: "unrelated three" },
        { path: "coupon.md", title: "Coupon", content: "payment dates only" },
    ];
    const { hybrid, sectionAware } = await strategies(docs);
    const h = await hybrid.retrieve({ query: "bonds", k: 2 });
    const s = await sectionAware.retrieve({ query: "bonds", k: 2 });
    // "coupon.md" shares no terms with the query — hybrid leaves it out of the top 2,
    // but section-aware pulls it in because the top hit links to it.
    assert.ok(!h.chunks.some((c) => c.path === "coupon.md"));
    assert.ok(s.chunks.some((c) => c.path === "coupon.md"));
});
test("pinned partition is boosted above an otherwise-equal page", async () => {
    const base = [
        { path: "top.md", title: "Top", content: "alpha beta" },
        { path: "a.md", title: "A", content: "alpha side" },
        { path: "b.md", title: "B", content: "alpha side" },
    ];
    const plain = await strategies(base);
    const withPin = await strategies(base.map((d) => (d.path === "b.md" ? { ...d, pinned: true } : d)));
    const unpinned = await plain.sectionAware.retrieve({ query: "alpha beta" });
    const pinned = await withPin.sectionAware.retrieve({ query: "alpha beta" });
    const rank = (r, path) => r.chunks.findIndex((c) => c.path === path);
    assert.ok(rank(unpinned, "a.md") < rank(unpinned, "b.md"));
    assert.ok(rank(pinned, "b.md") < rank(pinned, "a.md"));
});
test("diversification caps how many results come from one section", async () => {
    const docs = [
        { path: "a/1.md", title: "A1", content: "alpha", section: "a" },
        { path: "a/2.md", title: "A2", content: "alpha", section: "a" },
        { path: "a/3.md", title: "A3", content: "alpha", section: "a" },
        { path: "a/4.md", title: "A4", content: "alpha", section: "a" },
        { path: "b/1.md", title: "B1", content: "alpha", section: "b" },
    ];
    const { sectionAware } = await strategies(docs);
    const result = await sectionAware.retrieve({ query: "alpha", k: 4 });
    const fromA = result.chunks.filter((c) => c.section === "a").length;
    assert.ok(fromA <= 3);
    assert.ok(result.chunks.some((c) => c.section === "b"));
});
//# sourceMappingURL=section-aware.test.js.map