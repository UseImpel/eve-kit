import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { deserializeSidecar, sidecarFileName, } from "./embedding-sidecar.js";
function sha256(input) {
    return createHash("sha256").update(input).digest("hex");
}
// Load the v2 manifest. `manifestPath` points at wiki/_meta/index/manifest.json;
// `baseDir` (the wiki repo root the entry paths are relative to) defaults to
// three levels up from the manifest's directory.
export async function loadManifest(opts) {
    const baseDir = opts.baseDir ?? resolve(dirname(opts.manifestPath), "..", "..", "..");
    let manifestJson;
    try {
        manifestJson = await readFile(opts.manifestPath, "utf8");
    }
    catch (e) {
        throw new Error(`manifest v2 not found at ${opts.manifestPath} (${e.message}). ` +
            `The wiki release must include wiki/_meta/index/manifest.json — ` +
            `index.json is frozen and is NOT a fallback.`);
    }
    let manifest;
    try {
        const parsed = JSON.parse(manifestJson);
        if (parsed.version !== 2) {
            throw new Error(`unsupported manifest version: ${parsed.version}, expected 2`);
        }
        // Entries live under `docs` (the writer's source of truth) or `pages`
        // (the mirror the serializer re-derives from docs). Accept either —
        // requiring the mirror is exactly the throwing-reader mistake that kept
        // older manifests unreadable — but PREFER docs: manifests written before
        // the serializer re-mirrored on every release carry a stale `pages` copy
        // next to current `docs` (the deployed creador manifest has 70 such
        // entries), and reading the stale side quietly discards valid sidecars.
        const entries = Array.isArray(parsed.docs)
            ? parsed.docs
            : Array.isArray(parsed.pages)
                ? parsed.pages
                : null;
        if (!entries) {
            throw new Error("manifest has neither a pages nor a docs array");
        }
        if (typeof parsed.model !== "string" ||
            typeof parsed.dimensions !== "number") {
            throw new Error("manifest is missing model/dimensions");
        }
        manifest = {
            version: 2,
            model: parsed.model,
            dimensions: parsed.dimensions,
            // Drop entries that lack the two fields nothing can work without;
            // anything extra on an entry rides along untouched.
            pages: entries.filter((e) => typeof e?.path === "string" && typeof e?.title === "string"),
        };
    }
    catch (e) {
        throw new Error(`manifest v2 at ${opts.manifestPath} is unreadable: ${e.message}`);
    }
    const embeddingsDir = join(baseDir, "wiki", "_meta", "embeddings");
    const contentCache = new Map();
    const passageCache = new Map();
    async function getPageContent(path) {
        const cached = contentCache.get(path);
        if (cached !== undefined)
            return cached;
        // Entry paths are wiki-repo-root-relative and already include "wiki/".
        const content = await readFile(join(baseDir, path), "utf8");
        contentCache.set(path, content);
        return content;
    }
    async function loadPagePassages(path) {
        const entry = manifest.pages.find((p) => p.path === path);
        if (!entry?.contentHash)
            return null;
        const content = await getPageContent(path);
        // The sidecar's offsets (and the vectors themselves) describe the content
        // the hash was computed over; if the on-disk page has drifted, the vectors
        // are for text that no longer exists — backfill instead of serving them.
        if (sha256(content) !== entry.contentHash) {
            console.warn(`[manifest-loader] ${path}: content does not match manifest contentHash — ` +
                `ignoring sidecar, will backfill`);
            return null;
        }
        let buffer;
        try {
            buffer = await readFile(join(embeddingsDir, sidecarFileName(entry.contentHash, manifest.model, manifest.dimensions)));
        }
        catch {
            return null; // no sidecar for this page — backfill
        }
        try {
            const sidecar = decodeSidecar(buffer);
            if (sidecar.manifest.modelId !== manifest.model ||
                sidecar.manifest.dimensions !== manifest.dimensions) {
                console.warn(`[manifest-loader] ${path}: sidecar embedding space ` +
                    `${sidecar.manifest.modelId}@${sidecar.manifest.dimensions} does not match ` +
                    `manifest ${manifest.model}@${manifest.dimensions} — ignoring sidecar`);
                return null;
            }
            if (sidecar.manifest.passages.length !== sidecar.vectors.length) {
                return null;
            }
            // The VECTORS are exact — they embed ingestion's real passage texts, and
            // re-embedding a whole corpus on load is exactly the cost sidecars exist
            // to avoid. The offsets are only best-effort (the writer trims/rejoins
            // sections before recording them), so treat the sliced texts as snippet
            // material: clamp to content bounds, fall back to the page content when a
            // slice comes up empty, never reject the sidecar over them.
            let clamped = false;
            const texts = sidecar.manifest.passages.map((p) => {
                const start = Math.min(Math.max(p.charOffset, 0), content.length);
                const end = Math.min(Math.max(p.charOffset + p.charLength, start), content.length);
                if (start !== p.charOffset || end !== p.charOffset + p.charLength) {
                    clamped = true;
                }
                return content.slice(start, end).trim() || content;
            });
            if (clamped) {
                console.warn(`[manifest-loader] ${path}: sidecar passage offsets don't fit the content — ` +
                    `clamped snippet slices, vectors used as-is`);
            }
            return { texts, vectors: sidecar.vectors };
        }
        catch (e) {
            console.warn(`[manifest-loader] ${path}: sidecar unreadable (${e.message}) — ignoring`);
            return null;
        }
    }
    // Sidecars written through the GitHub tree API's `content` field were stored
    // as base64 TEXT rather than binary. Read them either way: raw bytes first,
    // then a base64 decode of the same bytes.
    function decodeSidecar(buffer) {
        try {
            return deserializeSidecar(buffer);
        }
        catch (rawError) {
            try {
                return deserializeSidecar(Buffer.from(buffer.toString("utf8").trim(), "base64"));
            }
            catch {
                throw rawError;
            }
        }
    }
    async function getPagePassages(path) {
        if (passageCache.has(path))
            return passageCache.get(path);
        const result = await loadPagePassages(path);
        passageCache.set(path, result);
        return result;
    }
    async function toPageDocs() {
        const docs = [];
        for (const entry of manifest.pages) {
            let content;
            try {
                content = await getPageContent(entry.path);
            }
            catch (e) {
                // Manifest/tree drift on ONE page shouldn't take down the whole corpus.
                console.warn(`[manifest-loader] ${entry.path}: listed in manifest but unreadable ` +
                    `(${e.message}) — skipping page`);
                continue;
            }
            docs.push({
                path: entry.path,
                title: entry.title,
                content,
                vault: entry.vault,
                section: entry.section,
                tags: entry.tags,
                links: entry.links,
                pinned: entry.pinned,
            });
        }
        return docs;
    }
    return {
        manifest,
        getPageContent,
        getPagePassages,
        toPageDocs,
    };
}
//# sourceMappingURL=manifest-loader.js.map