import { createHmac, timingSafeEqual } from "node:crypto";
export class RunTokenError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "RunTokenError";
    }
}
/**
 * HTTP request header that carries the signed run token on model calls.
 */
export const RUN_TOKEN_HEADER = "x-impel-run-token";
const RUN_TOKEN_VERSION = "v1";
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;
export function signRunToken(payload, secret) {
    const normalized = normalizeRunTokenPayload(payload);
    const payloadPart = base64UrlEncode(JSON.stringify({
        orgId: normalized.orgId,
        runId: normalized.runId,
        ...(normalized.impelUserId
            ? { impelUserId: normalized.impelUserId }
            : {}),
        ...(normalized.liveblocksUserId
            ? { liveblocksUserId: normalized.liveblocksUserId }
            : {}),
        ...(normalized.agentId ? { agentId: normalized.agentId } : {}),
        exp: normalized.exp,
    }));
    const signingInput = `${RUN_TOKEN_VERSION}.${payloadPart}`;
    const signaturePart = base64UrlEncode(hmacSha256(signingInput, secret));
    return `${signingInput}.${signaturePart}`;
}
export function verifyRunToken(token, secret, now = Math.floor(Date.now() / 1000)) {
    assertSecret(secret);
    if (typeof token !== "string" || token.length === 0) {
        throwRunTokenError("invalid_token", "Run token is missing.");
    }
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== RUN_TOKEN_VERSION) {
        throwRunTokenError("invalid_token", "Run token must be v1 compact format.");
    }
    const [, payloadPart, signaturePart] = parts;
    if (!isBase64Url(payloadPart) || !isBase64Url(signaturePart)) {
        throwRunTokenError("invalid_token", "Run token contains invalid encoding.");
    }
    const signingInput = `${RUN_TOKEN_VERSION}.${payloadPart}`;
    const expectedSignature = hmacSha256(signingInput, secret);
    const actualSignature = base64UrlDecode(signaturePart, "invalid_signature");
    if (!timingSafeBufferEqual(expectedSignature, actualSignature)) {
        throwRunTokenError("invalid_signature", "Run token signature is invalid.");
    }
    const payload = parseRunTokenPayload(payloadPart);
    if (payload.exp <= now) {
        throwRunTokenError("expired", "Run token has expired.");
    }
    return {
        orgId: payload.orgId,
        runId: payload.runId,
        ...(payload.impelUserId ? { impelUserId: payload.impelUserId } : {}),
        ...(payload.liveblocksUserId
            ? { liveblocksUserId: payload.liveblocksUserId }
            : {}),
        ...(payload.agentId ? { agentId: payload.agentId } : {}),
    };
}
function normalizeRunTokenPayload(payload) {
    if (!isRecord(payload)) {
        throwRunTokenError("invalid_payload", "Run token payload must be an object.");
    }
    const orgId = readNonEmptyString(payload.orgId);
    const runId = readNonEmptyString(payload.runId);
    const impelUserId = readNonEmptyString(payload.impelUserId);
    const liveblocksUserId = readNonEmptyString(payload.liveblocksUserId);
    const agentId = readNonEmptyString(payload.agentId);
    const exp = payload.exp;
    if (!orgId || !runId || !Number.isFinite(exp)) {
        throwRunTokenError("invalid_payload", "Run token payload requires orgId, runId, and exp.");
    }
    return {
        orgId,
        runId,
        ...(impelUserId ? { impelUserId } : {}),
        ...(liveblocksUserId ? { liveblocksUserId } : {}),
        ...(agentId ? { agentId } : {}),
        exp,
    };
}
function parseRunTokenPayload(payloadPart) {
    try {
        return normalizeRunTokenPayload(JSON.parse(base64UrlDecode(payloadPart, "invalid_payload").toString("utf8")));
    }
    catch (error) {
        if (error instanceof RunTokenError)
            throw error;
        throwRunTokenError("invalid_payload", "Run token payload is invalid JSON.");
    }
}
function hmacSha256(input, secret) {
    assertSecret(secret);
    return createHmac("sha256", secret).update(input).digest();
}
function assertSecret(secret) {
    if (typeof secret !== "string" || secret.length === 0) {
        throwRunTokenError("invalid_secret", "Run token secret is required.");
    }
}
function timingSafeBufferEqual(expected, actual) {
    if (actual.length !== expected.length) {
        const padded = Buffer.alloc(expected.length);
        actual.copy(padded, 0, 0, Math.min(actual.length, expected.length));
        timingSafeEqual(expected, padded);
        return false;
    }
    return timingSafeEqual(expected, actual);
}
function base64UrlEncode(value) {
    return Buffer.from(value).toString("base64url");
}
function base64UrlDecode(value, errorCode) {
    try {
        return Buffer.from(value, "base64url");
    }
    catch {
        throwRunTokenError(errorCode, "Run token contains invalid base64url data.");
    }
}
function isBase64Url(value) {
    return value.length > 0 && base64UrlPattern.test(value);
}
function readNonEmptyString(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function throwRunTokenError(code, message) {
    throw new RunTokenError(code, message);
}
//# sourceMappingURL=run-token.js.map