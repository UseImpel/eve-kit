/**
 * A wiki chunk returned by queryWiki, tagged with orgId for observability.
 */
export interface QueryWikiChunk {
    text: string;
    source: string;
    confidence: number;
    chunkId: string;
    orgId: string;
    path: string;
    title: string;
    score?: number;
    snippet?: string;
}
/**
 * Options for queryWiki.
 */
export interface QueryWikiOptions {
    /** Limit the number of results returned. Default: 5 */
    k?: number;
    /** Evidence gate confidence floor. Default: 0.35 */
    floor?: number;
}
/**
 * Result from queryWiki: chunks + gate decision + metadata.
 */
export interface QueryWikiResult {
    chunks: QueryWikiChunk[];
    gate: {
        gated: boolean;
        reason?: "no_results" | "low_confidence";
    };
    meta: {
        orgId: string;
        strategy: string;
        durationMs: number;
    };
}
/**
 * Resolve an orgId to its wiki vault path.
 *
 * For T1 (CFM Slack bot), we hardcode known orgs. In production,
 * this will call a connector layer to resolve the wiki path from
 * GitHub connectors or environment configuration.
 */
export declare function resolveWikiVault(orgId: string): string;
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
export declare function queryWiki(orgId: string, query: string, options?: QueryWikiOptions): Promise<QueryWikiResult>;
//# sourceMappingURL=query-wiki.d.ts.map