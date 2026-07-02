export interface RunTokenPayload {
    orgId: string;
    runId: string;
    /**
     * Expiration time as Unix epoch seconds.
     */
    exp: number;
}
export interface VerifiedRunToken {
    orgId: string;
    runId: string;
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
//# sourceMappingURL=run-token.d.ts.map