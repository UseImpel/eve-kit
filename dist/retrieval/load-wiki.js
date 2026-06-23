import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/;
async function collectMarkdown(root) {
    const out = [];
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith("."))
            continue;
        const abs = join(root, entry.name);
        if (entry.isDirectory()) {
            out.push(...(await collectMarkdown(abs)));
        }
        else if (entry.name.endsWith(".md")) {
            out.push(abs);
        }
    }
    return out;
}
function frontmatterValue(block, key) {
    const match = block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match ? match[1].trim().replace(/^["']|["']$/g, "") : undefined;
}
function stripFrontmatter(content) {
    return content.replace(FRONTMATTER, "");
}
function deriveTitle(content, path) {
    const fm = content.match(FRONTMATTER);
    const fmTitle = fm ? frontmatterValue(fm[1], "title") : undefined;
    if (fmTitle)
        return fmTitle;
    const heading = stripFrontmatter(content).match(/^#\s+(.+)$/m);
    if (heading)
        return heading[1].trim();
    const leaf = path.split("/").pop() ?? path;
    return leaf.replace(/\.md$/, "").replace(/[-_]+/g, " ");
}
function deriveTags(content) {
    const fm = content.match(FRONTMATTER);
    const raw = fm ? frontmatterValue(fm[1], "tags") : undefined;
    if (!raw)
        return undefined;
    const tags = raw
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    return tags.length > 0 ? tags : undefined;
}
// Provisional section = the top-level folder, so scope filtering works on a plain
// wiki today. Ingestion's section graph replaces this later behind the same field.
function deriveSection(path) {
    const segments = path.split("/");
    return segments.length > 1 ? segments[0] : undefined;
}
// Outgoing [[wikilinks]] -> targets, for backlink-aware retrieval. [[A|alias]]
// keeps "A". Provisional until ingestion emits the real link graph.
function deriveLinks(content) {
    const targets = new Set();
    for (const match of content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
        const target = match[1].trim();
        if (target)
            targets.add(target);
    }
    return targets.size > 0 ? [...targets] : undefined;
}
// A `pinned: true` frontmatter file is a user-curated partition — retrieval keeps
// it intact and boosts it, and synthesis must never merge it away.
function derivePinned(content) {
    const fm = content.match(FRONTMATTER);
    const raw = fm ? frontmatterValue(fm[1], "pinned") : undefined;
    return raw === "true" ? true : undefined;
}
// Load a wiki directory of markdown into WikiDoc[]. Title comes from frontmatter,
// else the first H1, else the filename. The eval harness uses this; in production
// the source is the platform's ingestion release.
export async function loadWikiDir(root, vault) {
    const files = await collectMarkdown(root);
    return Promise.all(files.map(async (abs) => {
        const raw = await readFile(abs, "utf8");
        const path = relative(root, abs).split(sep).join("/");
        const content = stripFrontmatter(raw);
        return {
            path,
            title: deriveTitle(raw, abs),
            content,
            tags: deriveTags(raw),
            section: deriveSection(path),
            links: deriveLinks(content),
            pinned: derivePinned(raw),
            vault,
        };
    }));
}
//# sourceMappingURL=load-wiki.js.map