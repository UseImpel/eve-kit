import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./embedder.js";
import { embeddingInput } from "./index-builder.js";
import { loadReleaseIndex, parseReleaseIndex } from "./release-index.js";
import { FlatEmbedStrategy } from "./strategies/flat-embed.js";
// Same token-hash fake as the other retrieval tests, sized to the real contract
// dims so the loaded index matches EMBEDDING_DIMENSIONS (no drift warning).
function fakeEmbedder(dims = EMBEDDING_DIMENSIONS) {
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
// Emit an index in ingestion's release shape: bonds arrives pre-embedded, brand
// ships WITHOUT a vector (the best-effort gateway gap retrieval must backfill).
async function writeEmittedIndex(dir) {
    const embed = fakeEmbedder();
    const bonds = {
        path: "finance/bonds.md",
        title: "Bonds",
        content: "A bond pays a coupon.",
        section: "finance",
        contentHash: "h1",
    };
    const brand = {
        path: "marketing/brand.md",
        title: "Brand",
        content: "Brand voice is warm.",
        section: "marketing",
        contentHash: "h2",
    };
    const [bondsVec] = await embed([embeddingInput(bonds)]);
    const docs = [
        { ...bonds, embedding: bondsVec },
        { ...brand }, // no embedding — must be backfilled on load
    ];
    const out = join(dir, "index.json");
    await writeFile(out, JSON.stringify({
        version: 1,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        docs,
    }));
    return out;
}
test("loadReleaseIndex backfills missing embeddings and serves queries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "release-index-"));
    try {
        const path = await writeEmittedIndex(dir);
        const embedder = fakeEmbedder();
        const { store, docs, stats } = await loadReleaseIndex({ path, embedder });
        assert.equal(stats.total, 2);
        assert.equal(stats.carried, 1); // bonds came pre-embedded
        assert.equal(stats.backfilled, 1); // brand was embedded on load
        assert.equal(store.size(), 2);
        assert.ok(docs.every((d) => d.embedding.length === EMBEDDING_DIMENSIONS));
        // Same space for carried + backfilled + query → rankings are meaningful.
        const result = await new FlatEmbedStrategy({ embedder, store }).retrieve({
            query: "bond coupon",
        });
        assert.equal(result.chunks[0]?.path, "finance/bonds.md");
    }
    finally {
        await rm(dir, { recursive: true, force: true });
    }
});
test("parseReleaseIndex rejects an unsupported version", () => {
    assert.throws(() => parseReleaseIndex(JSON.stringify({ version: 2, docs: [] })), /unsupported release index version/);
});
test("loadReleaseIndex preserves section + pinned from the emitted index", async () => {
    const dir = await mkdtemp(join(tmpdir(), "release-index-"));
    try {
        const embedder = fakeEmbedder();
        const [vec] = await embedder([
            embeddingInput({ path: "concepts/pinned.md", title: "Pinned", content: "x" }),
        ]);
        const out = join(dir, "index.json");
        await writeFile(out, JSON.stringify({
            version: 1,
            model: EMBEDDING_MODEL,
            dimensions: EMBEDDING_DIMENSIONS,
            docs: [
                {
                    path: "concepts/pinned.md",
                    title: "Pinned",
                    content: "x",
                    section: "concepts",
                    pinned: true,
                    contentHash: "h",
                    embedding: vec,
                },
            ],
        }));
        const { docs } = await loadReleaseIndex({ path: out, embedder });
        assert.equal(docs[0]?.section, "concepts");
        assert.equal(docs[0]?.pinned, true);
    }
    finally {
        await rm(dir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=release-index.test.js.map