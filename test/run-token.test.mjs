import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  RUN_TOKEN_HEADER,
  RUN_TOKEN_V2_AUDIENCE,
  RUN_TOKEN_V2_ISSUER,
  RUN_TOKEN_V2_MAX_LIFETIME_SECONDS,
  RUN_TOKEN_V2_RELEASE_ISSUER_PREFIX,
  RunTokenError,
  signGatewayRunToken,
  signReleaseGatewayRunToken,
  signRunToken,
  signRunTokenV2,
  verifyRunToken,
  verifyGatewayRunToken,
  verifyRunTokenV2,
} from "@useimpel/eve-kit/contracts/run-token";

const V2_VECTOR_SECRET = "impel-v2-cross-language-test-secret";
const V2_VECTOR_PAYLOAD = {
  iss: RUN_TOKEN_V2_ISSUER,
  aud: RUN_TOKEN_V2_AUDIENCE,
  orgId: "3Screens-Capital",
  runId: "run_0123456789abcdef",
  impelUserId: "impel-user-1",
  liveblocksUserId: "lb-user-1",
  agentId: "platform-engineer",
  iat: 2_000_000_000,
  exp: 2_000_004_500,
  scopes: ["claude-code-gateway"],
};
const V2_VECTOR_TOKEN =
  "v2.eyJpc3MiOiJ1cm46dXNlaW1wZWw6bmV4dCIsImF1ZCI6InVybjp1c2VpbXBlbDpnYXRld2F5OmluZmVyZW5jZSIsIm9yZ0lkIjoiM1NjcmVlbnMtQ2FwaXRhbCIsInJ1bklkIjoicnVuXzAxMjM0NTY3ODlhYmNkZWYiLCJpbXBlbFVzZXJJZCI6ImltcGVsLXVzZXItMSIsImxpdmVibG9ja3NVc2VySWQiOiJsYi11c2VyLTEiLCJhZ2VudElkIjoicGxhdGZvcm0tZW5naW5lZXIiLCJpYXQiOjIwMDAwMDAwMDAsImV4cCI6MjAwMDAwNDUwMCwic2NvcGVzIjpbImNsYXVkZS1jb2RlLWdhdGV3YXkiXX0.BwlUTHcDeVgCwl57hppHe1kylYyl09SPIJ1hMEYSWtY";

test("run token header name is the shared cross-repo contract", () => {
  assert.equal(RUN_TOKEN_HEADER, "x-impel-run-token");
});

test("run token round-trips verified identity", () => {
  const token = signRunToken(
    { orgId: "org_123", runId: "run_123", exp: 2_000 },
    "secret-a",
  );

  assert.deepEqual(verifyRunToken(token, "secret-a", 1_000), {
    orgId: "org_123",
    runId: "run_123",
  });
});

test("run token round-trips user and agent attribution claims", () => {
  const token = signRunToken(
    {
      orgId: "org_123",
      runId: "run_123",
      impelUserId: "usr_123",
      liveblocksUserId: "lb_123",
      agentId: "research-agent",
      exp: 2_000,
    },
    "secret-a",
  );

  assert.deepEqual(verifyRunToken(token, "secret-a", 1_000), {
    orgId: "org_123",
    runId: "run_123",
    impelUserId: "usr_123",
    liveblocksUserId: "lb_123",
    agentId: "research-agent",
  });
});

test("run token rejects tampered payload", () => {
  const token = signRunToken(
    { orgId: "org_123", runId: "run_123", exp: 2_000 },
    "secret-a",
  );
  const [version, payload, signature] = token.split(".");
  const tamperedPayload = Buffer.from(
    JSON.stringify({ orgId: "org_999", runId: "run_123", exp: 2_000 }),
  ).toString("base64url");

  assertRunTokenError(
    () => verifyRunToken(`${version}.${tamperedPayload}.${signature}`, "secret-a", 1_000),
    "invalid_signature",
  );
  assert.notEqual(tamperedPayload, payload);
});

test("run token rejects tampered signature", () => {
  const token = signRunToken(
    { orgId: "org_123", runId: "run_123", exp: 2_000 },
    "secret-a",
  );
  const [version, payload, signature] = token.split(".");
  const last = signature.at(-1) === "A" ? "B" : "A";
  const tamperedSignature = `${signature.slice(0, -1)}${last}`;

  assertRunTokenError(
    () => verifyRunToken(`${version}.${payload}.${tamperedSignature}`, "secret-a", 1_000),
    "invalid_signature",
  );
});

test("run token rejects expired token", () => {
  const token = signRunToken(
    { orgId: "org_123", runId: "run_123", exp: 1_000 },
    "secret-a",
  );

  assertRunTokenError(
    () => verifyRunToken(token, "secret-a", 1_000),
    "expired",
  );
});

test("run token rejects wrong secret", () => {
  const token = signRunToken(
    { orgId: "org_123", runId: "run_123", exp: 2_000 },
    "secret-a",
  );

  assertRunTokenError(
    () => verifyRunToken(token, "secret-b", 1_000),
    "invalid_signature",
  );
});

test("v2 matches the deterministic Go/TypeScript compatibility vector", () => {
  const token = signRunTokenV2(V2_VECTOR_PAYLOAD, V2_VECTOR_SECRET);
  assert.equal(token, V2_VECTOR_TOKEN);
  assert.deepEqual(
    verifyRunTokenV2(token, V2_VECTOR_SECRET, 2_000_000_001),
    V2_VECTOR_PAYLOAD,
  );

  const payloadJson = Buffer.from(token.split(".")[1], "base64url").toString();
  assert.deepEqual(Object.keys(JSON.parse(payloadJson)), [
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
});

test("v2 accepts exactly one recognized provider scope", () => {
  const codex = signRunTokenV2(
    { ...V2_VECTOR_PAYLOAD, scopes: ["codex-gateway"] },
    V2_VECTOR_SECRET,
  );
  assert.deepEqual(
    verifyRunTokenV2(codex, V2_VECTOR_SECRET, 2_000_000_001).scopes,
    ["codex-gateway"],
  );

  for (const scopes of [
    [],
    ["claude-code-gateway", "codex-gateway"],
    ["codex-api"],
  ]) {
    assertRunTokenError(
      () =>
        signRunTokenV2(
          { ...V2_VECTOR_PAYLOAD, scopes },
          V2_VECTOR_SECRET,
        ),
      "invalid_payload",
    );
  }
});

test("v2 pins issuer, audience, lifetime, issued-at skew, and expiration", () => {
  assertRunTokenError(
    () =>
      signRunTokenV2(
        { ...V2_VECTOR_PAYLOAD, iss: "urn:attacker" },
        V2_VECTOR_SECRET,
      ),
    "invalid_payload",
  );
  assertRunTokenError(
    () =>
      signRunTokenV2(
        { ...V2_VECTOR_PAYLOAD, aud: "urn:attacker" },
        V2_VECTOR_SECRET,
      ),
    "invalid_payload",
  );
  assertRunTokenError(
    () =>
      signRunTokenV2(
        {
          ...V2_VECTOR_PAYLOAD,
          exp:
            V2_VECTOR_PAYLOAD.iat +
            RUN_TOKEN_V2_MAX_LIFETIME_SECONDS +
            1,
        },
        V2_VECTOR_SECRET,
      ),
    "invalid_payload",
  );

  const future = signRunTokenV2(
    {
      ...V2_VECTOR_PAYLOAD,
      iat: 2_000,
      exp: 3_000,
    },
    V2_VECTOR_SECRET,
  );
  assertRunTokenError(
    () => verifyRunTokenV2(future, V2_VECTOR_SECRET, 1_900),
    "invalid_payload",
  );
  assertRunTokenError(
    () => verifyRunTokenV2(future, V2_VECTOR_SECRET, 3_000),
    "expired",
  );
});

test("v2 canonical aliases and claim validation match the gateway verifier", () => {
  assert.equal(signGatewayRunToken(V2_VECTOR_PAYLOAD, V2_VECTOR_SECRET), V2_VECTOR_TOKEN);
  assert.deepEqual(
    verifyGatewayRunToken(V2_VECTOR_TOKEN, V2_VECTOR_SECRET, 2_000_000_001),
    V2_VECTOR_PAYLOAD,
  );

  for (const patch of [
    { orgId: " padded" },
    { orgId: "org:other" },
    { runId: "run:other" },
    { runId: "run/other" },
    { orgId: "a".repeat(129) },
    { agentId: " agent" },
    { impelUserId: "user\nother" },
    { liveblocksUserId: "ü".repeat(129) },
    { iat: 0 },
  ]) {
    assertRunTokenError(
      () =>
        signGatewayRunToken(
          { ...V2_VECTOR_PAYLOAD, ...patch },
          V2_VECTOR_SECRET,
        ),
      "invalid_payload",
    );
  }

  assertRunTokenError(
    () =>
      signGatewayRunToken(
        { ...V2_VECTOR_PAYLOAD, role: "admin" },
        V2_VECTOR_SECRET,
      ),
    "invalid_payload",
  );

  const unknownFieldToken = mintRawV2Token(
    { ...V2_VECTOR_PAYLOAD, role: "admin" },
    V2_VECTOR_SECRET,
  );
  assertRunTokenError(
    () =>
      verifyGatewayRunToken(
        unknownFieldToken,
        V2_VECTOR_SECRET,
        2_000_000_001,
      ),
    "invalid_payload",
  );
});

test("release-CI signer is explicit, scoped, and cannot assert a user", () => {
  const releaseIssuer =
    `${RUN_TOKEN_V2_RELEASE_ISSUER_PREFIX}3screenscapital-impel-agents`;
  const releaseSecret =
    "release-signing-secret-0123456789abcdef0123456789abcdef";
  const basePayload = {
    iss: releaseIssuer,
    aud: RUN_TOKEN_V2_AUDIENCE,
    orgId: "3screenscapital",
    runId: "release-run-1",
    agentId: "quant",
    iat: 2_000_000_000,
    exp: 2_000_000_600,
    scopes: ["codex-gateway"],
  };
  const token = signReleaseGatewayRunToken(basePayload, releaseSecret);
  const [version, payloadPart, signature] = token.split(".");
  const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString());
  const expectedSignature = createHmac("sha256", releaseSecret)
    .update(`${version}.${payloadPart}`)
    .digest("base64url");

  assert.equal(version, "v2");
  assert.equal(signature, expectedSignature);
  assert.deepEqual(payload, basePayload);

  const bomSecret = `\ufeff${releaseSecret}\ufeff`;
  const bomToken = signReleaseGatewayRunToken(basePayload, bomSecret);
  const [bomVersion, bomPayloadPart, bomSignature] = bomToken.split(".");
  assert.equal(
    bomSignature,
    createHmac("sha256", bomSecret)
      .update(`${bomVersion}.${bomPayloadPart}`)
      .digest("base64url"),
  );

  for (const patch of [
    { iss: RUN_TOKEN_V2_ISSUER },
    { iss: `${RUN_TOKEN_V2_RELEASE_ISSUER_PREFIX}bad/issuer` },
    { agentId: "" },
    { agentId: "other/agent" },
    { impelUserId: "user-1" },
    { liveblocksUserId: "lb-user-1" },
  ]) {
    assertRunTokenError(
      () =>
        signReleaseGatewayRunToken(
          { ...basePayload, ...patch },
          releaseSecret,
        ),
      "invalid_payload",
    );
  }

  for (const invalidSecret of [
    "short",
    ` ${releaseSecret}`,
    `${releaseSecret}\u0000`,
    `${"\t".repeat(400)}${releaseSecret}`,
    "x".repeat(513),
  ]) {
    assertRunTokenError(
      () => signReleaseGatewayRunToken(basePayload, invalidSecret),
      "invalid_secret",
    );
  }

  assertRunTokenError(
    () =>
      signGatewayRunToken(
        { ...V2_VECTOR_PAYLOAD, iss: releaseIssuer },
        releaseSecret,
      ),
    "invalid_payload",
  );
});

test("v2 rejects the same non-canonical raw JSON shapes as the Go verifier", () => {
  const canonical = JSON.stringify(V2_VECTOR_PAYLOAD);
  const duplicateIssuer = canonical.replace(
    `"iss":"${RUN_TOKEN_V2_ISSUER}"`,
    `"iss":"${RUN_TOKEN_V2_ISSUER}","iss":"urn:attacker"`,
  );
  const escapedDuplicateIssuer = canonical.replace(
    `"iss":"${RUN_TOKEN_V2_ISSUER}"`,
    `"iss":"${RUN_TOKEN_V2_ISSUER}","i\\u0073s":"urn:attacker"`,
  );
  const exponentTimestamp = canonical.replace(
    `"iat":${V2_VECTOR_PAYLOAD.iat}`,
    '"iat":2e9',
  );

  const cases = [
    ["top-level array", "[]"],
    ["duplicate exact key", duplicateIssuer],
    ["duplicate escaped key", escapedDuplicateIssuer],
    ["case-variant key", rawV2Payload({ ISS: RUN_TOKEN_V2_ISSUER })],
    ["unknown key", rawV2Payload({ role: "admin" })],
    ["missing required key", rawV2Payload({}, ["aud"])],
    ["required string null", rawV2Payload({ iss: null })],
    ["required string number", rawV2Payload({ orgId: 123 })],
    ["required string boolean", rawV2Payload({ runId: true })],
    ["optional string null", rawV2Payload({ agentId: null })],
    ["optional string number", rawV2Payload({ impelUserId: 123 })],
    ["timestamp string", rawV2Payload({ iat: "2000000000" })],
    ["timestamp null", rawV2Payload({ exp: null })],
    ["timestamp fraction", rawV2Payload({ exp: 2_000_004_499.5 })],
    ["timestamp exponent", exponentTimestamp],
    ["scopes null", rawV2Payload({ scopes: null })],
    ["scopes string", rawV2Payload({ scopes: "claude-code-gateway" })],
    ["scope item null", rawV2Payload({ scopes: [null] })],
    ["scope item number", rawV2Payload({ scopes: [123] })],
    ["trailing JSON", `${canonical} {}`],
  ];

  for (const [name, rawPayload] of cases) {
    assertRunTokenError(
      () =>
        verifyGatewayRunToken(
          mintRawV2JsonToken(rawPayload, V2_VECTOR_SECRET),
          V2_VECTOR_SECRET,
          2_000_000_001,
        ),
      "invalid_payload",
      name,
    );
  }
});

function assertRunTokenError(fn, code, message) {
  assert.throws(
    fn,
    (error) => error instanceof RunTokenError && error.code === code,
    message,
  );
}

function mintRawV2Token(payload, secret) {
  return mintRawV2JsonToken(JSON.stringify(payload), secret);
}

function mintRawV2JsonToken(rawPayload, secret) {
  const payloadPart = Buffer.from(rawPayload).toString("base64url");
  const signingInput = `v2.${payloadPart}`;
  const signature = createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

function rawV2Payload(patch = {}, omittedKeys = []) {
  const payload = { ...V2_VECTOR_PAYLOAD, ...patch };
  for (const key of omittedKeys) delete payload[key];
  return JSON.stringify(payload);
}
