import { Retrieval } from "../../retrieval/index.js";
/**
 * Resolve an orgId to its wiki vault path.
 *
 * For T1 (CFM Slack bot), we hardcode known orgs. In production,
 * this will call a connector layer to resolve the wiki path from
 * GitHub connectors or environment configuration.
 */
export function resolveWikiVault(orgId) {
    // Map org IDs to their wiki vault paths.
    // For now, we use environment overrides or hardcoded paths.
    // In production, this calls the Impel ingestion connector layer.
    const vaultMap = {
        cfm: process.env.WIKI_VAULT_CFM || "wikis/cfm",
        default: process.env.WIKI_VAULT_DEFAULT || "wikis/default",
    };
    const vault = vaultMap[orgId];
    if (!vault) {
        throw new Error(`Wiki not configured for org: ${orgId}. Available orgs: ${Object.keys(vaultMap).join(", ")}`);
    }
    return vault;
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
 * @param orgId Organization ID (e.g., 'cfm'). Must be a known org.
 * @param query Search query (e.g., 'payroll policy')
 * @param options Optional: { k, floor }
 * @returns Promise<QueryWikiResult> with chunks, gate, and metadata
 * @throws Error if orgId is not configured or retrieval fails critically
 */
export async function queryWiki(orgId, query, options) {
    const startMs = Date.now();
    try {
        // Validate and resolve the org's wiki vault path.
        const vault = resolveWikiVault(orgId);
        // Load the pre-built wiki index for this org.
        // If the wiki doesn't exist, Retrieval.fromReleaseIndex will throw.
        let retrieval;
        try {
            retrieval = await Retrieval.fromReleaseIndex({ vault });
        }
        catch (err) {
            // Missing wiki is treated gracefully: return empty results.
            const durationMs = Date.now() - startMs;
            const result = {
                chunks: [],
                gate: { gated: true, reason: "no_results" },
                meta: {
                    orgId,
                    strategy: "section-aware",
                    durationMs,
                },
            };
            console.log(`[queryWiki] orgId=${orgId} durationMs=${durationMs} gated=true reason=missing_wiki`);
            return result;
        }
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
//# sourceMappingURL=query-wiki.js.map