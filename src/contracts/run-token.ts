import { createHmac, timingSafeEqual } from "node:crypto";

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

export const RUN_TOKEN_V2_VERSION = "v2";
export const RUN_TOKEN_V2_ISSUER = "urn:useimpel:next";
export const RUN_TOKEN_V2_RELEASE_ISSUER_PREFIX =
  "urn:useimpel:release-ci:";
export const RUN_TOKEN_V2_AUDIENCE = "urn:useimpel:gateway:inference";
export const RUN_TOKEN_V2_MAX_LIFETIME_SECONDS = 4_500;
export const RUN_TOKEN_V2_CLOCK_SKEW_SECONDS = 60;
export const RUN_TOKEN_V2_MAX_TOKEN_BYTES = 8 * 1_024;
export const RUN_TOKEN_V2_SCOPES = [
  "claude-code-gateway",
  "codex-gateway",
] as const;

export type RunTokenV2Scope = (typeof RUN_TOKEN_V2_SCOPES)[number];
export type RunTokenV2ReleaseIssuer =
  `${typeof RUN_TOKEN_V2_RELEASE_ISSUER_PREFIX}${string}`;

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

export type RunTokenErrorCode =
  | "invalid_payload"
  | "invalid_secret"
  | "invalid_token"
  | "invalid_signature"
  | "expired";

export class RunTokenError extends Error {
  constructor(
    readonly code: RunTokenErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RunTokenError";
  }
}

/**
 * HTTP request header that carries the signed run token on model calls.
 */
export const RUN_TOKEN_HEADER = "x-impel-run-token";

const RUN_TOKEN_VERSION = "v1";
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

export function signRunToken(payload: RunTokenPayload, secret: string): string {
  const normalized = normalizeRunTokenPayload(payload);
  const payloadPart = base64UrlEncode(
    JSON.stringify({
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
    }),
  );
  const signingInput = `${RUN_TOKEN_VERSION}.${payloadPart}`;
  const signaturePart = base64UrlEncode(hmacSha256(signingInput, secret));
  return `${signingInput}.${signaturePart}`;
}

export function verifyRunToken(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): VerifiedRunToken {
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
export function signRunTokenV2(
  payload: RunTokenV2Payload,
  secret: string,
): string {
  const normalized = normalizeRunTokenV2Payload(
    payload,
    RUN_TOKEN_V2_ISSUER,
  );
  return signNormalizedRunTokenV2(
    normalized,
    normalizeRunTokenV2Secret(secret),
  );
}

/**
 * Signs a release-CI capability without broadening the trusted platform signer.
 * The gateway remains authoritative for the configured issuer/org/agent map.
 */
export function signReleaseGatewayRunToken(
  payload: ReleaseRunTokenV2Payload,
  secret: string,
): string {
  if (!isPlainRecord(payload) || !canonicalReleaseIssuer(payload.iss)) {
    throwRunTokenError(
      "invalid_payload",
      "Release run token issuer is invalid.",
    );
  }
  if (
    !canonicalOrgId(payload.agentId) ||
    "impelUserId" in payload ||
    "liveblocksUserId" in payload
  ) {
    throwRunTokenError(
      "invalid_payload",
      "Release run token requires one canonical agent and no user identity.",
    );
  }
  const normalized = normalizeRunTokenV2Payload(payload, payload.iss);
  return signNormalizedRunTokenV2(
    normalized,
    normalizeReleaseSignerSecret(secret),
  );
}

function signNormalizedRunTokenV2(
  normalized: NormalizedRunTokenV2,
  normalizedSecret: string,
): string {
  const payloadPart = base64UrlEncode(
    JSON.stringify({
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
    }),
  );
  const signingInput = `${RUN_TOKEN_V2_VERSION}.${payloadPart}`;
  const signaturePart = base64UrlEncode(
    hmacSha256(signingInput, normalizedSecret),
  );
  return `${signingInput}.${signaturePart}`;
}

export function verifyRunTokenV2(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): VerifiedRunTokenV2 {
  const normalizedSecret = normalizeRunTokenV2Secret(secret);
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    Buffer.byteLength(token, "utf8") > RUN_TOKEN_V2_MAX_TOKEN_BYTES
  ) {
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
    throwRunTokenError(
      "invalid_payload",
      "Run token issued-at time is too far in the future.",
    );
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

function normalizeRunTokenPayload(payload: RunTokenPayload): RunTokenPayload {
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
    throwRunTokenError(
      "invalid_payload",
      "Run token payload requires orgId, runId, and exp.",
    );
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

function normalizeRunTokenV2Payload(
  payload: RunTokenV2Payload | ReleaseRunTokenV2Payload,
  expectedIssuer: string,
): NormalizedRunTokenV2 {
  if (!isPlainRecord(payload) || !hasOnlyRunTokenV2Keys(payload)) {
    throwRunTokenError("invalid_payload", "Run token payload must be an object.");
  }
  if (payload.iss !== expectedIssuer) {
    throwRunTokenError("invalid_payload", "Run token issuer is invalid.");
  }
  if (payload.aud !== RUN_TOKEN_V2_AUDIENCE) {
    throwRunTokenError("invalid_payload", "Run token audience is invalid.");
  }

  const orgId = canonicalOrgId(payload.orgId) ? payload.orgId : undefined;
  const runId = canonicalRunId(payload.runId) ? payload.runId : undefined;
  if (
    !canonicalOptionalClaim(payload.impelUserId) ||
    !canonicalOptionalClaim(payload.liveblocksUserId) ||
    !canonicalOptionalClaim(payload.agentId)
  ) {
    throwRunTokenError("invalid_payload", "Run token attribution is invalid.");
  }
  const impelUserId = readNonEmptyString(payload.impelUserId);
  const liveblocksUserId = readNonEmptyString(payload.liveblocksUserId);
  const agentId = readNonEmptyString(payload.agentId);
  const iat = payload.iat;
  const exp = payload.exp;
  const scopes = payload.scopes;
  if (
    !orgId ||
    !runId ||
    !Number.isSafeInteger(iat) ||
    iat <= 0 ||
    !Number.isSafeInteger(exp) ||
    exp <= iat
  ) {
    throwRunTokenError(
      "invalid_payload",
      "Run token payload requires orgId, runId, and a valid iat/exp window.",
    );
  }
  if (exp - iat > RUN_TOKEN_V2_MAX_LIFETIME_SECONDS) {
    throwRunTokenError(
      "invalid_payload",
      `Run token lifetime must not exceed ${RUN_TOKEN_V2_MAX_LIFETIME_SECONDS} seconds.`,
    );
  }
  if (
    !Array.isArray(scopes) ||
    scopes.length !== 1 ||
    !isRunTokenV2Scope(scopes[0])
  ) {
    throwRunTokenError(
      "invalid_payload",
      "Run token requires exactly one recognized inference scope.",
    );
  }

  return {
    iss: expectedIssuer,
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

function parseRunTokenPayload(payloadPart: string): RunTokenPayload {
  try {
    return normalizeRunTokenPayload(
      JSON.parse(base64UrlDecode(payloadPart, "invalid_payload").toString("utf8")),
    );
  } catch (error) {
    if (error instanceof RunTokenError) throw error;
    throwRunTokenError("invalid_payload", "Run token payload is invalid JSON.");
  }
}

function parseRunTokenV2Payload(payloadPart: string): VerifiedRunTokenV2 {
  try {
    const rawPayload = base64UrlDecode(
      payloadPart,
      "invalid_payload",
    ).toString("utf8");
    validateRunTokenV2RawPayload(rawPayload);
    return normalizeRunTokenV2Payload(
      JSON.parse(rawPayload),
      RUN_TOKEN_V2_ISSUER,
    ) as VerifiedRunTokenV2;
  } catch (error) {
    if (error instanceof RunTokenError) throw error;
    throwRunTokenError("invalid_payload", "Run token payload is invalid JSON.");
  }
}

function hmacSha256(input: string, secret: string): Buffer {
  assertSecret(secret);
  return createHmac("sha256", secret).update(input).digest();
}

function assertSecret(secret: string): void {
  if (typeof secret !== "string" || secret.length === 0) {
    throwRunTokenError("invalid_secret", "Run token secret is required.");
  }
}

function timingSafeBufferEqual(expected: Buffer, actual: Buffer): boolean {
  if (actual.length !== expected.length) {
    const padded = Buffer.alloc(expected.length);
    actual.copy(padded, 0, 0, Math.min(actual.length, expected.length));
    timingSafeEqual(expected, padded);
    return false;
  }
  return timingSafeEqual(expected, actual);
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(
  value: string,
  errorCode: RunTokenErrorCode,
): Buffer {
  try {
    return Buffer.from(value, "base64url");
  } catch {
    throwRunTokenError(errorCode, "Run token contains invalid base64url data.");
  }
}

function isBase64Url(value: string): boolean {
  return value.length > 0 && base64UrlPattern.test(value);
}

function isRunTokenV2Scope(value: unknown): value is RunTokenV2Scope {
  return (
    typeof value === "string" &&
    (RUN_TOKEN_V2_SCOPES as readonly string[]).includes(value)
  );
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
] as const;

type RunTokenV2RawMemberKind = "string" | "integer" | "scopes";

function runTokenV2RawMemberKind(
  key: string,
): RunTokenV2RawMemberKind | undefined {
  if (
    key === "iss" ||
    key === "aud" ||
    key === "orgId" ||
    key === "runId" ||
    key === "impelUserId" ||
    key === "liveblocksUserId" ||
    key === "agentId"
  ) {
    return "string";
  }
  if (key === "iat" || key === "exp") return "integer";
  if (key === "scopes") return "scopes";
  return undefined;
}

/**
 * Mirrors the Go verifier's token-level JSON inspection before JSON.parse.
 * JavaScript otherwise keeps the last duplicate member and normalizes exponent
 * timestamps, both of which are invalid for the signed capability contract.
 */
function validateRunTokenV2RawPayload(rawPayload: string): void {
  const cursor = new RawJsonCursor(rawPayload);
  const seen = new Set<string>();

  cursor.skipWhitespace();
  cursor.expect("{");
  cursor.skipWhitespace();
  if (!cursor.consume("}")) {
    while (true) {
      const key = cursor.readString();
      if (seen.has(key)) throw new SyntaxError(`Duplicate member ${key}.`);
      const kind = runTokenV2RawMemberKind(key);
      if (!kind) throw new SyntaxError(`Unknown member ${key}.`);
      seen.add(key);

      cursor.skipWhitespace();
      cursor.expect(":");
      cursor.skipWhitespace();
      if (kind === "string") cursor.readString();
      else if (kind === "integer") cursor.readInteger();
      else cursor.readStringArray();

      cursor.skipWhitespace();
      if (cursor.consume("}")) break;
      cursor.expect(",");
      cursor.skipWhitespace();
    }
  }

  cursor.skipWhitespace();
  if (!cursor.atEnd()) throw new SyntaxError("Unexpected trailing JSON.");
  for (const key of RUN_TOKEN_V2_REQUIRED_KEYS) {
    if (!seen.has(key)) throw new SyntaxError(`Missing member ${key}.`);
  }
}

class RawJsonCursor {
  private index = 0;

  constructor(private readonly input: string) {}

  atEnd(): boolean {
    return this.index === this.input.length;
  }

  skipWhitespace(): void {
    while (
      this.input[this.index] === " " ||
      this.input[this.index] === "\t" ||
      this.input[this.index] === "\n" ||
      this.input[this.index] === "\r"
    ) {
      this.index += 1;
    }
  }

  consume(expected: string): boolean {
    if (this.input[this.index] !== expected) return false;
    this.index += 1;
    return true;
  }

  expect(expected: string): void {
    if (!this.consume(expected)) {
      throw new SyntaxError(`Expected ${expected}.`);
    }
  }

  readString(): string {
    const start = this.index;
    this.expect('"');
    while (this.index < this.input.length) {
      const char = this.input[this.index];
      if (char === '"') {
        this.index += 1;
        const value = JSON.parse(this.input.slice(start, this.index));
        if (typeof value !== "string") throw new SyntaxError("Expected string.");
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

  readInteger(): void {
    const start = this.index;
    while (
      this.index < this.input.length &&
      !",}\t\n\r ".includes(this.input[this.index] ?? "")
    ) {
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

  readStringArray(): void {
    this.expect("[");
    this.skipWhitespace();
    if (this.consume("]")) return;
    while (true) {
      this.readString();
      this.skipWhitespace();
      if (this.consume("]")) return;
      this.expect(",");
      this.skipWhitespace();
    }
  }
}

function hasOnlyRunTokenV2Keys(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => RUN_TOKEN_V2_ALLOWED_KEYS.has(key));
}

function canonicalOrgId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_.-]+$/.test(value)
  );
}

function canonicalReleaseIssuer(
  value: unknown,
): value is RunTokenV2ReleaseIssuer {
  if (
    typeof value !== "string" ||
    !value.startsWith(RUN_TOKEN_V2_RELEASE_ISSUER_PREFIX)
  ) {
    return false;
  }
  return canonicalOrgId(value.slice(RUN_TOKEN_V2_RELEASE_ISSUER_PREFIX.length));
}

function canonicalRunId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_.-]+$/.test(value)
  );
}

function canonicalOptionalClaim(value: unknown): boolean {
  if (value === undefined || value === "") return true;
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    Buffer.byteLength(value, "utf8") > 256
  ) {
    return false;
  }
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

function normalizeRunTokenV2Secret(secret: string): string {
  const normalized = typeof secret === "string" ? secret.trim() : "";
  assertSecret(normalized);
  return normalized;
}

function normalizeReleaseSignerSecret(secret: string): string {
  if (typeof secret !== "string") {
    throwRunTokenError("invalid_secret", "Release signer secret is invalid.");
  }
  const bytes = Buffer.byteLength(secret, "utf8");
  if (
    bytes < 32 ||
    bytes > 512 ||
    secret !== trimGoSpace(secret)
  ) {
    throwRunTokenError("invalid_secret", "Release signer secret is invalid.");
  }
  for (const char of secret) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) {
      throwRunTokenError("invalid_secret", "Release signer secret is invalid.");
    }
  }
  return secret;
}

function trimGoSpace(value: string): string {
  return value.replace(
    /^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/gu,
    "",
  );
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && !Array.isArray(value);
}

type NormalizedRunTokenV2 = Omit<VerifiedRunTokenV2, "iss"> & {
  iss: string;
};

function throwRunTokenError(
  code: RunTokenErrorCode,
  message: string,
): never {
  throw new RunTokenError(code, message);
}
