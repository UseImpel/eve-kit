import { basename, dirname, join } from "node:path";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, gatewayEmbedder, } from "./embedder.js";
import { embeddingInput } from "./index-builder.js";
import { splitPassages } from "./passage-splitter.js";
import { loadManifest } from "./manifest-loader.js";
import { InMemoryVectorStore } from "./vector-store.js";
// Consume the artifact INGESTION emits at release: the v2 manifest at
// wiki/_meta/index/manifest.json plus passage-vector sidecars (see
// manifest-loader.ts for the full layout, and impel-ingestion's
// agent/lib/stores/release-index.ts for the write side). This is the read side
// of the shared seam — the one path that turns the released artifact into a
// queryable store, so retrieval answers over the real wiki without owning the
// build.
//
// There is deliberately NO fallback to the old monolithic wiki/_meta/index.json.
// Ingestion stopped writing it on 2026-07-05; loading it means confidently
// answering from a corpus frozen at that date while the wiki keeps growing —
// strictly worse than failing. A missing manifest is a hard error.
export const RELEASE_INDEX_V2_PATH = "wiki/_meta/index/manifest.json";
// Accept either the manifest path itself or (legacy callers) the old
// wiki/_meta/index.json path, which maps to the manifest sitting in the index/
// dir beside it. Anything else is passed through untouched.
function resolveManifestPath(path) {
    if (basename(path) === "index.json") {
        return join(dirname(path), "index", "manifest.json");
    }
    return path;
}
// Load the released manifest + sidecars into a queryable store. Passage vectors
// come from the sidecars where present; pages without a usable sidecar are
// split and embedded NOW — and crucially in the same model + dimensions the
// manifest records, so backfilled vectors land in the same space as the carried
// ones. The returned `embedder` is that same manifest-pinned embedder: pass it
// to the strategy so the QUERY is embedded in that space too, or the rankings
// are garbage (the one mechanical rule of this seam).
//
// Pass your own `embedder` only in tests/offline; production should let it
// default so the space always follows the manifest, not retrieval's constants.
export async function loadReleaseIndex(opts) {
    const manifestPath = resolveManifestPath(opts.path);
    // loadManifest throws loudly when the manifest is missing or unreadable —
    // that error must reach the caller, so no try/catch here.
    const loader = await loadManifest({ manifestPath });
    const model = loader.manifest.model;
    const dimensions = loader.manifest.dimensions;
    if (model !== EMBEDDING_MODEL || dimensions !== EMBEDDING_DIMENSIONS) {
        console.warn(`[release-index] v2 manifest embedding ${model}@${dimensions} ` +
            `differs from retrieval default ${EMBEDDING_MODEL}@${EMBEDDING_DIMENSIONS} — ` +
            `querying in the manifest's space`);
    }
    const embedder = opts.embedder ?? gatewayEmbedder({ model, dimensions });
    const pageDocs = await loader.toPageDocs();
    const passages = [];
    const embeddedDocs = [];
    let carried = 0;
    let backfilled = 0;
    for (const pageDoc of pageDocs) {
        // Sidecar first: its own passage offsets keep texts aligned with vectors,
        // with no dependency on the writer and reader splitting identically.
        const sidecarPassages = await loader.getPagePassages(pageDoc.path);
        let texts;
        let vectors;
        if (sidecarPassages) {
            texts = sidecarPassages.texts;
            vectors = sidecarPassages.vectors;
            carried += texts.length;
        }
        else {
            // No usable sidecar — split and embed here. Prefix the title exactly as
            // ingestion does when it embeds sidecar passages, so backfilled vectors
            // live in the same neighbourhood as carried ones.
            texts = splitPassages(pageDoc.content);
            vectors =
                texts.length > 0
                    ? await embedder(texts.map((t) => `${pageDoc.title}\n\n${t}`))
                    : [];
            backfilled += texts.length;
        }
        for (let i = 0; i < texts.length; i++) {
            passages.push({
                pageId: pageDoc.path,
                index: i,
                text: texts[i],
                embedding: vectors[i],
            });
        }
        // Page-level vector: first passage's, or an embedding of the doc summary
        // input for pages that produced no passages (e.g. empty content).
        const pageEmbedding = vectors[0] ?? (await embedder([embeddingInput(pageDoc)]))[0];
        embeddedDocs.push({ ...pageDoc, embedding: pageEmbedding });
    }
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
//# sourceMappingURL=release-index.js.map