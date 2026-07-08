import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RUN_TOKEN_HEADER,
  RunTokenError,
  signRunToken,
  verifyRunToken,
} from "@useimpel/eve-kit/contracts/run-token";

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

function assertRunTokenError(fn, code) {
  assert.throws(
    fn,
    (error) => error instanceof RunTokenError && error.code === code,
  );
}
