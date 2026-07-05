import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
// Load the v2 manifest. Assumes the directory structure:
//   manifest.json      <- manifest file
//   pages/             <- .md files for each page (path already includes .md)
//   vectors/           <- sidecar .json files with passage vectors (path.json)
export async function loadManifest(opts) {
    const baseDir = opts.baseDir ?? dirname(opts.manifestPath);
    const manifestJson = await readFile(opts.manifestPath, "utf8");
    const manifest = JSON.parse(manifestJson);
    if (manifest.version !== 2) {
        throw new Error(`Unsupported manifest version: ${manifest.version}, expected 2`);
    }
    if (!Array.isArray(manifest.pages)) {
        throw new Error("Manifest has no pages array");
    }
    // Cache for lazy-loaded content
    const contentCache = new Map();
    const vectorCache = new Map();
    async function getPageContent(path) {
        if (contentCache.has(path)) {
            return contentCache.get(path);
        }
        // path already includes .md (e.g., "finance/bonds.md")
        const contentPath = join(baseDir, "pages", path);
        const content = await readFile(contentPath, "utf8");
        contentCache.set(path, content);
        return content;
    }
    async function getPassageVectors(path) {
        if (vectorCache.has(path)) {
            return vectorCache.get(path);
        }
        // path is "finance/bonds.md", vectors file is "finance/bonds.md.json"
        const vectorPath = join(baseDir, "vectors", `${path}.json`);
        const json = await readFile(vectorPath, "utf8");
        const vectors = JSON.parse(json);
        vectorCache.set(path, vectors);
        return vectors;
    }
    async function toPageDocs() {
        const docs = [];
        for (const entry of manifest.pages) {
            const content = await getPageContent(entry.path);
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
        getPassageVectors,
        toPageDocs,
    };
}
//# sourceMappingURL=manifest-loader.js.map