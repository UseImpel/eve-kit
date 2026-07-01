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
    /** Resolve orgId to a wiki vault path. Defaults to env map or wikis/${orgId}. */
    vaultResolver?: WikiVaultResolver | WikiVaultMap;
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
export interface WikiVaultLocation {
    /** Optional connector/source repo metadata retained for callers. */
    repo?: string;
    /** Local vault path used by retrieval. */
    path: string;
}
export type WikiVaultResolverResult = string | WikiVaultLocation | null | undefined;
export type WikiVaultResolver = (orgId: string) => WikiVaultResolverResult;
export type WikiVaultMap = Readonly<Record<string, string | WikiVaultLocation>>;
export interface ResolveWikiVaultOptions {
    env?: NodeJS.ProcessEnv;
    vaultResolver?: WikiVaultResolver | WikiVaultMap;
}
/**
 * Resolve an orgId to its wiki vault path.
 *
 * Resolution order:
 * 1. Injected resolver function or config map.
 * 2. JSON object from IMPEL_WIKI_VAULT_MAP.
 * 3. Documented convention fallback: wikis/${orgId}.
 */
export declare function resolveWikiVault(orgId: string): string;
export declare function resolveWikiVault(orgId: string, options: ResolveWikiVaultOptions): string;
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
export declare function queryWiki(orgId: string, query: string, options?: QueryWikiOptions): Promise<QueryWikiResult>;
//# sourceMappingURL=query-wiki.d.ts.map