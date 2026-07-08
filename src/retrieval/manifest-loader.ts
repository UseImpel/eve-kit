import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import {
  deserializeSidecar,
  sidecarFileName,
} from "./embedding-sidecar.js";
import type { WikiDoc } from "./types.js";

// Load the v2 release artifact ingestion actually emits. The layout, all
// relative to the WIKI REPO ROOT (a checkout of the org's wiki repository):
//
//   wiki/<section>/<page>.md                              <- page content IS the wiki
//   wiki/_meta/index/manifest.json                        <- slim metadata manifest
//   wiki/_meta/embeddings/<hash>__<model>__<dims>.bin     <- passage-vector sidecars
//
// Manifest entries carry root-relative paths ("wiki/concepts/x.md") plus the
// page's contentHash, which keys its sidecar. There is no content or vector data
// in the manifest itself — content comes from the wiki tree, vectors from the
// sidecars, both lazily.
//
// Reader discipline (the lesson of the frozen-index incident, design notes §7):
// tolerant to SHAPE — entries may live under `pages` or `docs` (the serializer
// mirrors one from the other; requiring the mirror is what made older manifests
// unreadable), unknown fields are ignored, a page whose file or sidecar is
// missing degrades per-page (skip / backfill) — but LOUD on ABSENCE: a missing
// or unparseable manifest throws immediately. Never fall back to
// wiki/_meta/index.json; that file is frozen (2026-07-05) and answering from it
// means confidently answering from a corpus that stopped growing.

// A page entry in the v2 manifest (unknown fields tolerated and ignored).
export type ManifestEntry = {
  path: string;
  title: string;
  vault?: string;
  section?: string;
  tags?: string[];
  links?: string[];
  pinned?: boolean;
  contentHash?: string;
};

export type ManifestV2 = {
  version: 2;
  model: string;
  dimensions: number;
  pages: ManifestEntry[];
};

// A page's passages with their vectors, texts sliced by the sidecar's own
// offsets so texts[i] is exactly what vectors[i] embeds. `null` = no usable
// sidecar (missing, malformed, hash/model drift) — the caller backfills.
export type PagePassages = {
  texts: string[];
  vectors: number[][];
} | null;

// Lazy-load facade: the manifest is read up front; content and vectors are
// fetched per page on demand, so cold startup never pays for the whole corpus.
export interface ManifestLoader {
  manifest: ManifestV2;
  getPageContent(path: string): Promise<string>;
  getPagePassages(path: string): Promise<PagePassages>;
  toPageDocs(): Promise<WikiDoc[]>;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// Load the v2 manifest. `manifestPath` points at wiki/_meta/index/manifest.json;
// `baseDir` (the wiki repo root the entry paths are relative to) defaults to
// three levels up from the manifest's directory.
export async function loadManifest(opts: {
  manifestPath: string;
  baseDir?: string;
}): Promise<ManifestLoader> {
  const baseDir =
    opts.baseDir ?? resolve(dirname(opts.manifestPath), "..", "..", "..");

  let manifestJson: string;
  try {
    manifestJson = await readFile(opts.manifestPath, "utf8");
  } catch (e) {
    throw new Error(
      `manifest v2 not found at ${opts.manifestPath} (${(e as Error).message}). ` +
        `The wiki release must include wiki/_meta/index/manifest.json — ` +
        `index.json is frozen and is NOT a fallback.`
    );
  }

  let manifest: ManifestV2;
  try {
    const parsed = JSON.parse(manifestJson) as ManifestV2 & {
      docs?: ManifestEntry[];
    };
    if (parsed.version !== 2) {
      throw new Error(
        `unsupported manifest version: ${parsed.version}, expected 2`
      );
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
    if (
      typeof parsed.model !== "string" ||
      typeof parsed.dimensions !== "number"
    ) {
      throw new Error("manifest is missing model/dimensions");
    }
    manifest = {
      version: 2,
      model: parsed.model,
      dimensions: parsed.dimensions,
      // Drop entries that lack the two fields nothing can work without;
      // anything extra on an entry rides along untouched.
      pages: entries.filter(
        (e) => typeof e?.path === "string" && typeof e?.title === "string"
      ),
    };
  } catch (e) {
    throw new Error(
      `manifest v2 at ${opts.manifestPath} is unreadable: ${(e as Error).message}`
    );
  }

  const embeddingsDir = join(baseDir, "wiki", "_meta", "embeddings");
  const contentCache = new Map<string, string>();
  const passageCache = new Map<string, PagePassages>();

  async function getPageContent(path: string): Promise<string> {
    const cached = contentCache.get(path);
    if (cached !== undefined) return cached;
    // Entry paths are wiki-repo-root-relative and already include "wiki/".
    const content = await readFile(join(baseDir, path), "utf8");
    contentCache.set(path, content);
    return content;
  }

  async function loadPagePassages(path: string): Promise<PagePassages> {
    const entry = manifest.pages.find((p) => p.path === path);
    if (!entry?.contentHash) return null;

    const content = await getPageContent(path);
    // The sidecar's offsets (and the vectors themselves) describe the content
    // the hash was computed over; if the on-disk page has drifted, the vectors
    // are for text that no longer exists — backfill instead of serving them.
    if (sha256(content) !== entry.contentHash) {
      console.warn(
        `[manifest-loader] ${path}: content does not match manifest contentHash — ` +
          `ignoring sidecar, will backfill`
      );
      return null;
    }

    let buffer: Buffer;
    try {
      buffer = await readFile(
        join(
          embeddingsDir,
          sidecarFileName(entry.contentHash, manifest.model, manifest.dimensions)
        )
      );
    } catch {
      return null; // no sidecar for this page — backfill
    }

    try {
      const sidecar = decodeSidecar(buffer);
      if (
        sidecar.manifest.modelId !== manifest.model ||
        sidecar.manifest.dimensions !== manifest.dimensions
      ) {
        console.warn(
          `[manifest-loader] ${path}: sidecar embedding space ` +
            `${sidecar.manifest.modelId}@${sidecar.manifest.dimensions} does not match ` +
            `manifest ${manifest.model}@${manifest.dimensions} — ignoring sidecar`
        );
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
        console.warn(
          `[manifest-loader] ${path}: sidecar passage offsets don't fit the content — ` +
            `clamped snippet slices, vectors used as-is`
        );
      }
      return { texts, vectors: sidecar.vectors };
    } catch (e) {
      console.warn(
        `[manifest-loader] ${path}: sidecar unreadable (${(e as Error).message}) — ignoring`
      );
      return null;
    }
  }

  // Sidecars written through the GitHub tree API's `content` field were stored
  // as base64 TEXT rather than binary. Read them either way: raw bytes first,
  // then a base64 decode of the same bytes.
  function decodeSidecar(buffer: Buffer) {
    try {
      return deserializeSidecar(buffer);
    } catch (rawError) {
      try {
        return deserializeSidecar(
          Buffer.from(buffer.toString("utf8").trim(), "base64")
        );
      } catch {
        throw rawError;
      }
    }
  }

  async function getPagePassages(path: string): Promise<PagePassages> {
    if (passageCache.has(path)) return passageCache.get(path)!;
    const result = await loadPagePassages(path);
    passageCache.set(path, result);
    return result;
  }

  async function toPageDocs(): Promise<WikiDoc[]> {
    const docs: WikiDoc[] = [];
    for (const entry of manifest.pages) {
      let content: string;
      try {
        content = await getPageContent(entry.path);
      } catch (e) {
        // Manifest/tree drift on ONE page shouldn't take down the whole corpus.
        console.warn(
          `[manifest-loader] ${entry.path}: listed in manifest but unreadable ` +
            `(${(e as Error).message}) — skipping page`
        );
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
