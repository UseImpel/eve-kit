export interface RunTokenPayload {
    orgId: string;
    runId: string;
    impelUserId?: string;
    liveblocksUserId?: string;
    agentId?: string;
    /**
     * Expiration time as Unix epoch seconds.
     */
    exp: number;
}
export interface VerifiedRunToken {
    orgId: string;
    runId: string;
    impelUserId?: string;
    liveblocksUserId?: string;
    agentId?: string;
}
export declare const RUN_TOKEN_V2_VERSION = "v2";
export declare const RUN_TOKEN_V2_ISSUER = "urn:useimpel:next";
export declare const RUN_TOKEN_V2_RELEASE_ISSUER_PREFIX = "urn:useimpel:release-ci:";
export declare const RUN_TOKEN_V2_AUDIENCE = "urn:useimpel:gateway:inference";
export declare const RUN_TOKEN_V2_MAX_LIFETIME_SECONDS = 4500;
export declare const RUN_TOKEN_V2_CLOCK_SKEW_SECONDS = 60;
export declare const RUN_TOKEN_V2_MAX_TOKEN_BYTES: number;
export declare const RUN_TOKEN_V2_SCOPES: readonly ["claude-code-gateway", "codex-gateway"];
export type RunTokenV2Scope = (typeof RUN_TOKEN_V2_SCOPES)[number];
export type RunTokenV2ReleaseIssuer = `${typeof RUN_TOKEN_V2_RELEASE_ISSUER_PREFIX}${string}`;
/**
 * Capability-scoped hosted inference token claims.
 *
 * Keep this capability on the server-only Next → Eve → gateway path. It must
 * never be exposed to browser clients.
 */
export interface RunTokenV2Payload {
    iss: typeof RUN_TOKEN_V2_ISSUER;
    aud: typeof RUN_TOKEN_V2_AUDIENCE;
    orgId: string;
    runId: string;
    impelUserId?: string;
    liveblocksUserId?: string;
    agentId?: string;
    /** Issued-at time as Unix epoch seconds. */
    iat: number;
    /** Expiration time as Unix epoch seconds. */
    exp: number;
    /** Exactly one provider capability is required. */
    scopes: readonly [RunTokenV2Scope];
}
/**
 * Release-CI form of the hosted inference capability.
 *
 * The gateway binds this issuer and its distinct secret to one exact org and
 * agent allowlist. Release callers cannot assert end-user identity.
 */
export interface ReleaseRunTokenV2Payload {
    iss: RunTokenV2ReleaseIssuer;
    aud: typeof RUN_TOKEN_V2_AUDIENCE;
    orgId: string;
    runId: string;
    agentId: string;
    iat: number;
    exp: number;
    scopes: readonly [RunTokenV2Scope];
}
export interface VerifiedRunTokenV2 {
    iss: typeof RUN_TOKEN_V2_ISSUER;
    aud: typeof RUN_TOKEN_V2_AUDIENCE;
    orgId: string;
    runId: string;
    impelUserId?: string;
    liveblocksUserId?: string;
    agentId?: string;
    iat: number;
    exp: number;
    scopes: [RunTokenV2Scope];
}
export type RunTokenErrorCode = "invalid_payload" | "invalid_secret" | "invalid_token" | "invalid_signature" | "expired";
export declare class RunTokenError extends Error {
    readonly code: RunTokenErrorCode;
    constructor(code: RunTokenErrorCode, message: string);
}
/**
 * HTTP request header that carries the signed run token on model calls.
 */
export declare const RUN_TOKEN_HEADER = "x-impel-run-token";
export declare function signRunToken(payload: RunTokenPayload, secret: string): string;
export declare function verifyRunToken(token: string, secret: string, now?: number): VerifiedRunToken;
/**
 * Signs the deterministic v2 compact wire format.
 *
 * JSON field order is part of the cross-language compatibility contract:
 * iss, aud, orgId, runId, optional attribution, iat, exp, scopes.
 */
export declare function signRunTokenV2(payload: RunTokenV2Payload, secret: string): string;
/**
 * Signs a release-CI capability without broadening the trusted platform signer.
 * The gateway remains authoritative for the configured issuer/org/agent map.
 */
export declare function signReleaseGatewayRunToken(payload: ReleaseRunTokenV2Payload, secret: string): string;
export declare function verifyRunTokenV2(token: string, secret: string, now?: number): VerifiedRunTokenV2;
/** Canonical Next-facing name for the v2 hosted inference capability. */
export declare const signGatewayRunToken: typeof signRunTokenV2;
/** Canonical gateway-facing name for the v2 hosted inference capability. */
export declare const verifyGatewayRunToken: typeof verifyRunTokenV2;
//# sourceMappingURL=run-token.d.ts.map