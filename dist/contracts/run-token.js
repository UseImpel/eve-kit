import { createHmac, timingSafeEqual } from "node:crypto";
export const RUN_TOKEN_V2_VERSION = "v2";
export const RUN_TOKEN_V2_ISSUER = "urn:useimpel:next";
export const RUN_TOKEN_V2_AUDIENCE = "urn:useimpel:gateway:inference";
export const RUN_TOKEN_V2_MAX_LIFETIME_SECONDS = 4_500;
export const RUN_TOKEN_V2_CLOCK_SKEW_SECONDS = 60;
export const RUN_TOKEN_V2_MAX_TOKEN_BYTES = 8 * 1_024;
export const RUN_TOKEN_V2_SCOPES = [
    "claude-code-gateway",
    "codex-gateway",
];
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
/**
 * Signs the deterministic v2 compact wire format.
 *
 * JSON field order is part of the cross-language compatibility contract:
 * iss, aud, orgId, runId, optional attribution, iat, exp, scopes.
 */
export function signRunTokenV2(payload, secret) {
    const normalized = normalizeRunTokenV2Payload(payload);
    const payloadPart = base64UrlEncode(JSON.stringify({
        iss: normalized.iss,
        aud: normalized.aud,
        orgId: normalized.orgId,
        runId: normalized.runId,
        ...(normalized.impelUserId
            ? { impelUserId: normalized.impelUserId }
            : {}),
        ...(normalized.liveblocksUserId
            ? { liveblocksUserId: normalized.liveblocksUserId }
            : {}),
        ...(normalized.agentId ? { agentId: normalized.agentId } : {}),
        iat: normalized.iat,
        exp: normalized.exp,
        scopes: normalized.scopes,
    }));
    const signingInput = `${RUN_TOKEN_V2_VERSION}.${payloadPart}`;
    const signaturePart = base64UrlEncode(hmacSha256(signingInput, normalizeRunTokenV2Secret(secret)));
    return `${signingInput}.${signaturePart}`;
}
export function verifyRunTokenV2(token, secret, now = Math.floor(Date.now() / 1000)) {
    const normalizedSecret = normalizeRunTokenV2Secret(secret);
    if (typeof token !== "string" ||
        token.length === 0 ||
        Buffer.byteLength(token, "utf8") > RUN_TOKEN_V2_MAX_TOKEN_BYTES) {
        throwRunTokenError("invalid_token", "Run token is missing.");
    }
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== RUN_TOKEN_V2_VERSION) {
        throwRunTokenError("invalid_token", "Run token must be v2 compact format.");
    }
    const [, payloadPart, signaturePart] = parts;
    if (!isBase64Url(payloadPart) || !isBase64Url(signaturePart)) {
        throwRunTokenError("invalid_token", "Run token contains invalid encoding.");
    }
    const signingInput = `${RUN_TOKEN_V2_VERSION}.${payloadPart}`;
    const expectedSignature = hmacSha256(signingInput, normalizedSecret);
    const actualSignature = base64UrlDecode(signaturePart, "invalid_signature");
    if (!timingSafeBufferEqual(expectedSignature, actualSignature)) {
        throwRunTokenError("invalid_signature", "Run token signature is invalid.");
    }
    const payload = parseRunTokenV2Payload(payloadPart);
    if (payload.iat > now + RUN_TOKEN_V2_CLOCK_SKEW_SECONDS) {
        throwRunTokenError("invalid_payload", "Run token issued-at time is too far in the future.");
    }
    if (payload.exp <= now) {
        throwRunTokenError("expired", "Run token has expired.");
    }
    return payload;
}
/** Canonical Next-facing name for the v2 hosted inference capability. */
export const signGatewayRunToken = signRunTokenV2;
/** Canonical gateway-facing name for the v2 hosted inference capability. */
export const verifyGatewayRunToken = verifyRunTokenV2;
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
function normalizeRunTokenV2Payload(payload) {
    if (!isPlainRecord(payload) || !hasOnlyRunTokenV2Keys(payload)) {
        throwRunTokenError("invalid_payload", "Run token payload must be an object.");
    }
    if (payload.iss !== RUN_TOKEN_V2_ISSUER) {
        throwRunTokenError("invalid_payload", "Run token issuer is invalid.");
    }
    if (payload.aud !== RUN_TOKEN_V2_AUDIENCE) {
        throwRunTokenError("invalid_payload", "Run token audience is invalid.");
    }
    const orgId = canonicalOrgId(payload.orgId) ? payload.orgId : undefined;
    const runId = canonicalRunId(payload.runId) ? payload.runId : undefined;
    if (!canonicalOptionalClaim(payload.impelUserId) ||
        !canonicalOptionalClaim(payload.liveblocksUserId) ||
        !canonicalOptionalClaim(payload.agentId)) {
        throwRunTokenError("invalid_payload", "Run token attribution is invalid.");
    }
    const impelUserId = readNonEmptyString(payload.impelUserId);
    const liveblocksUserId = readNonEmptyString(payload.liveblocksUserId);
    const agentId = readNonEmptyString(payload.agentId);
    const iat = payload.iat;
    const exp = payload.exp;
    const scopes = payload.scopes;
    if (!orgId ||
        !runId ||
        !Number.isSafeInteger(iat) ||
        iat <= 0 ||
        !Number.isSafeInteger(exp) ||
        exp <= iat) {
        throwRunTokenError("invalid_payload", "Run token payload requires orgId, runId, and a valid iat/exp window.");
    }
    if (exp - iat > RUN_TOKEN_V2_MAX_LIFETIME_SECONDS) {
        throwRunTokenError("invalid_payload", `Run token lifetime must not exceed ${RUN_TOKEN_V2_MAX_LIFETIME_SECONDS} seconds.`);
    }
    if (!Array.isArray(scopes) ||
        scopes.length !== 1 ||
        !isRunTokenV2Scope(scopes[0])) {
        throwRunTokenError("invalid_payload", "Run token requires exactly one recognized inference scope.");
    }
    return {
        iss: RUN_TOKEN_V2_ISSUER,
        aud: RUN_TOKEN_V2_AUDIENCE,
        orgId,
        runId,
        ...(impelUserId ? { impelUserId } : {}),
        ...(liveblocksUserId ? { liveblocksUserId } : {}),
        ...(agentId ? { agentId } : {}),
        iat,
        exp,
        scopes: [scopes[0]],
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
function parseRunTokenV2Payload(payloadPart) {
    try {
        const rawPayload = base64UrlDecode(payloadPart, "invalid_payload").toString("utf8");
        validateRunTokenV2RawPayload(rawPayload);
        return normalizeRunTokenV2Payload(JSON.parse(rawPayload));
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
function isRunTokenV2Scope(value) {
    return (typeof value === "string" &&
        RUN_TOKEN_V2_SCOPES.includes(value));
}
const RUN_TOKEN_V2_ALLOWED_KEYS = new Set([
    "iss",
    "aud",
    "orgId",
    "runId",
    "impelUserId",
    "liveblocksUserId",
    "agentId",
    "iat",
    "exp",
    "scopes",
]);
const RUN_TOKEN_V2_REQUIRED_KEYS = [
    "iss",
    "aud",
    "orgId",
    "runId",
    "iat",
    "exp",
    "scopes",
];
function runTokenV2RawMemberKind(key) {
    if (key === "iss" ||
        key === "aud" ||
        key === "orgId" ||
        key === "runId" ||
        key === "impelUserId" ||
        key === "liveblocksUserId" ||
        key === "agentId") {
        return "string";
    }
    if (key === "iat" || key === "exp")
        return "integer";
    if (key === "scopes")
        return "scopes";
    return undefined;
}
/**
 * Mirrors the Go verifier's token-level JSON inspection before JSON.parse.
 * JavaScript otherwise keeps the last duplicate member and normalizes exponent
 * timestamps, both of which are invalid for the signed capability contract.
 */
function validateRunTokenV2RawPayload(rawPayload) {
    const cursor = new RawJsonCursor(rawPayload);
    const seen = new Set();
    cursor.skipWhitespace();
    cursor.expect("{");
    cursor.skipWhitespace();
    if (!cursor.consume("}")) {
        while (true) {
            const key = cursor.readString();
            if (seen.has(key))
                throw new SyntaxError(`Duplicate member ${key}.`);
            const kind = runTokenV2RawMemberKind(key);
            if (!kind)
                throw new SyntaxError(`Unknown member ${key}.`);
            seen.add(key);
            cursor.skipWhitespace();
            cursor.expect(":");
            cursor.skipWhitespace();
            if (kind === "string")
                cursor.readString();
            else if (kind === "integer")
                cursor.readInteger();
            else
                cursor.readStringArray();
            cursor.skipWhitespace();
            if (cursor.consume("}"))
                break;
            cursor.expect(",");
            cursor.skipWhitespace();
        }
    }
    cursor.skipWhitespace();
    if (!cursor.atEnd())
        throw new SyntaxError("Unexpected trailing JSON.");
    for (const key of RUN_TOKEN_V2_REQUIRED_KEYS) {
        if (!seen.has(key))
            throw new SyntaxError(`Missing member ${key}.`);
    }
}
class RawJsonCursor {
    input;
    index = 0;
    constructor(input) {
        this.input = input;
    }
    atEnd() {
        return this.index === this.input.length;
    }
    skipWhitespace() {
        while (this.input[this.index] === " " ||
            this.input[this.index] === "\t" ||
            this.input[this.index] === "\n" ||
            this.input[this.index] === "\r") {
            this.index += 1;
        }
    }
    consume(expected) {
        if (this.input[this.index] !== expected)
            return false;
        this.index += 1;
        return true;
    }
    expect(expected) {
        if (!this.consume(expected)) {
            throw new SyntaxError(`Expected ${expected}.`);
        }
    }
    readString() {
        const start = this.index;
        this.expect('"');
        while (this.index < this.input.length) {
            const char = this.input[this.index];
            if (char === '"') {
                this.index += 1;
                const value = JSON.parse(this.input.slice(start, this.index));
                if (typeof value !== "string")
                    throw new SyntaxError("Expected string.");
                return value;
            }
            if ((char?.charCodeAt(0) ?? 0) < 0x20) {
                throw new SyntaxError("Unescaped control character in string.");
            }
            if (char !== "\\") {
                this.index += 1;
                continue;
            }
            this.index += 1;
            const escaped = this.input[this.index];
            if (escaped === "u") {
                const digits = this.input.slice(this.index + 1, this.index + 5);
                if (!/^[0-9A-Fa-f]{4}$/.test(digits)) {
                    throw new SyntaxError("Invalid Unicode escape.");
                }
                this.index += 5;
                continue;
            }
            if (!escaped || !'"\\/bfnrt'.includes(escaped)) {
                throw new SyntaxError("Invalid string escape.");
            }
            this.index += 1;
        }
        throw new SyntaxError("Unterminated string.");
    }
    readInteger() {
        const start = this.index;
        while (this.index < this.input.length &&
            !",}\t\n\r ".includes(this.input[this.index] ?? "")) {
            this.index += 1;
        }
        const raw = this.input.slice(start, this.index);
        if (!/^-?(?:0|[1-9][0-9]*)$/.test(raw)) {
            throw new SyntaxError("Expected lexical integer.");
        }
        const value = BigInt(raw);
        if (value < -(2n ** 63n) || value > 2n ** 63n - 1n) {
            throw new SyntaxError("Integer is outside int64 range.");
        }
    }
    readStringArray() {
        this.expect("[");
        this.skipWhitespace();
        if (this.consume("]"))
            return;
        while (true) {
            this.readString();
            this.skipWhitespace();
            if (this.consume("]"))
                return;
            this.expect(",");
            this.skipWhitespace();
        }
    }
}
function hasOnlyRunTokenV2Keys(value) {
    return Object.keys(value).every((key) => RUN_TOKEN_V2_ALLOWED_KEYS.has(key));
}
function canonicalOrgId(value) {
    return (typeof value === "string" &&
        value.length >= 1 &&
        value.length <= 128 &&
        /^[A-Za-z0-9_.-]+$/.test(value));
}
function canonicalRunId(value) {
    return (typeof value === "string" &&
        value.length >= 1 &&
        value.length <= 128 &&
        /^[A-Za-z0-9_.-]+$/.test(value));
}
function canonicalOptionalClaim(value) {
    if (value === undefined || value === "")
        return true;
    if (typeof value !== "string" ||
        value !== value.trim() ||
        Buffer.byteLength(value, "utf8") > 256) {
        return false;
    }
    for (const char of value) {
        const code = char.codePointAt(0) ?? 0;
        if (code < 0x20 || code === 0x7f)
            return false;
    }
    return true;
}
function normalizeRunTokenV2Secret(secret) {
    const normalized = typeof secret === "string" ? secret.trim() : "";
    assertSecret(normalized);
    return normalized;
}
function readNonEmptyString(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function isPlainRecord(value) {
    return isRecord(value) && !Array.isArray(value);
}
function throwRunTokenError(code, message) {
    throw new RunTokenError(code, message);
}
//# sourceMappingURL=run-token.js.map