import { Retrieval } from "../../retrieval/index.js";
export function resolveWikiVault(orgId, options = {}) {
    const injected = resolveInjectedWikiVault(orgId, options.vaultResolver);
    if (injected)
        return injected;
    const fromEnv = resolveEnvWikiVault(orgId, options.env ?? process.env);
    if (fromEnv)
        return fromEnv;
    return `wikis/${orgId}`;
}
/**
 * Query the wiki for a specific organization.
 *
 * This is the agent-facing API: it routes to the org's wiki vault,
 * loads the pre-built index, runs retrieval with the section-aware
 * strategy, applies the evidence gate, and returns structured results.
 *
 * All results are tagged with orgId for observability.
 * All calls are logged to console (Eve Span context in Phase 2).
 *
 * @param orgId Organization ID.
 * @param query Search query.
 * @param options Optional: { k, floor, vaultResolver }
 * @returns Promise<QueryWikiResult> with chunks, gate, and metadata
 * @throws Error if retrieval fails critically
 */
export async function queryWiki(orgId, query, options) {
    const startMs = Date.now();
    try {
        // Validate and resolve the org's wiki vault path.
        const vault = resolveWikiVault(orgId, {
            vaultResolver: options?.vaultResolver,
        });
        // Load the pre-built wiki manifest for this org. A missing/unreadable
        // manifest THROWS (see the outer catch) — it used to be masked as
        // "no results", which is indistinguishable from a healthy wiki that
        // simply doesn't cover the query, and left agents answering as if the
        // wiki were empty. Better the agent sees the real failure.
        const retrieval = await Retrieval.fromReleaseIndex({ vault });
        // Run the retrieval with optional k and floor.
        const answer = await retrieval.query(query, {
            k: options?.k ?? 5,
            floor: options?.floor,
        });
        // Tag all chunks with orgId.
        const chunks = answer.chunks.map((chunk) => ({
            text: chunk.snippet || "",
            source: "wiki",
            confidence: answer.confidence,
            chunkId: chunk.path,
            orgId,
            path: chunk.path,
            title: chunk.title,
            score: chunk.score,
            snippet: chunk.snippet,
        }));
        const durationMs = Date.now() - startMs;
        const result = {
            chunks,
            gate: answer.gate,
            meta: {
                orgId,
                strategy: answer.strategy,
                durationMs,
            },
        };
        // Log for observability.
        console.log(`[queryWiki] orgId=${orgId} durationMs=${durationMs} gated=${answer.gate.gated} chunks=${chunks.length}`);
        return result;
    }
    catch (err) {
        // Re-throw critical errors (invalid orgId, severe retrieval failures).
        const durationMs = Date.now() - startMs;
        console.error(`[queryWiki] orgId=${orgId} durationMs=${durationMs} error=${err instanceof Error ? err.message : String(err)}`);
        throw err;
    }
}
function resolveInjectedWikiVault(orgId, resolver) {
    if (!resolver)
        return undefined;
    const result = typeof resolver === "function" ? resolver(orgId) : resolver[orgId];
    return wikiVaultPathFromValue(result, "vaultResolver");
}
function resolveEnvWikiVault(orgId, env) {
    const raw = env.IMPEL_WIKI_VAULT_MAP?.trim();
    if (!raw)
        return undefined;
    const parsed = parseWikiVaultMap(raw);
    return wikiVaultPathFromValue(parsed[orgId], "IMPEL_WIKI_VAULT_MAP");
}
function parseWikiVaultMap(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
        throw new Error(`IMPEL_WIKI_VAULT_MAP must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!isRecord(parsed)) {
        throw new Error("IMPEL_WIKI_VAULT_MAP must be a JSON object.");
    }
    return parsed;
}
function wikiVaultPathFromValue(value, source) {
    if (value == null)
        return undefined;
    if (typeof value === "string")
        return nonEmptyString(value);
    if (isRecord(value)) {
        const path = nonEmptyString(value.path);
        if (path)
            return path;
    }
    throw new Error(`${source} wiki vault values must be strings or objects with a path string.`);
}
function nonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
//# sourceMappingURL=query-wiki.js.map