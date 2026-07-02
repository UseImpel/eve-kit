import { createHmac, timingSafeEqual } from "node:crypto";

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

  return { orgId: payload.orgId, runId: payload.runId };
}

function normalizeRunTokenPayload(payload: RunTokenPayload): RunTokenPayload {
  if (!isRecord(payload)) {
    throwRunTokenError("invalid_payload", "Run token payload must be an object.");
  }

  const orgId = readNonEmptyString(payload.orgId);
  const runId = readNonEmptyString(payload.runId);
  const exp = payload.exp;
  if (!orgId || !runId || !Number.isFinite(exp)) {
    throwRunTokenError(
      "invalid_payload",
      "Run token payload requires orgId, runId, and exp.",
    );
  }

  return { orgId, runId, exp };
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

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function throwRunTokenError(
  code: RunTokenErrorCode,
  message: string,
): never {
  throw new RunTokenError(code, message);
}
