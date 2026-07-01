import { test } from "node:test";
import assert from "node:assert/strict";
import { queryWiki, resolveWikiVault, type QueryWikiResult } from "./query-wiki.js";

test("resolveWikiVault('cfm') returns a vault path", () => {
  // Set up an env var to override the default.
  process.env.WIKI_VAULT_CFM = "test-vault-cfm";
  const vault = resolveWikiVault("cfm");
  assert.equal(vault, "test-vault-cfm");
  delete process.env.WIKI_VAULT_CFM;
});

test("resolveWikiVault('cfm') uses default if no env", () => {
  // Ensure no env var is set.
  delete process.env.WIKI_VAULT_CFM;
  const vault = resolveWikiVault("cfm");
  assert.equal(vault, "wikis/cfm");
});

test("resolveWikiVault('unknown-org') throws", () => {
  assert.throws(() => {
    resolveWikiVault("unknown-org-xyz");
  }, /Wiki not configured for org/);
});

test("queryWiki invalid orgId throws", async () => {
  try {
    await queryWiki("invalid-org-999", "test query");
    assert.fail("Expected error for invalid org");
  } catch (err) {
    assert(
      err instanceof Error && err.message.includes("Wiki not configured for org"),
      "Should throw for invalid org"
    );
  }
});

test("queryWiki missing wiki returns gracefully", async () => {
  // Set vault to a non-existent path so fromReleaseIndex fails gracefully.
  process.env.WIKI_VAULT_CFM = "/nonexistent/vault/cfm";

  const result = await queryWiki("cfm", "payroll policy");

  assert.equal(result.chunks.length, 0, "Missing wiki should return empty chunks");
  assert.equal(result.gate.gated, true, "Gate should be gated on empty results");
  assert.equal(result.gate.reason, "no_results", "Reason should be no_results");
  assert.equal(result.meta.orgId, "cfm", "Meta should include orgId");
  assert.ok(result.meta.durationMs >= 0, "Meta should include durationMs");

  delete process.env.WIKI_VAULT_CFM;
});

test("queryWiki result has required structure", async () => {
  process.env.WIKI_VAULT_CFM = "/nonexistent/vault/cfm";

  const result: QueryWikiResult = await queryWiki("cfm", "test");

  // Even with empty chunks, the structure should be valid.
  assert.ok(Array.isArray(result.chunks), "chunks should be an array");
  assert.ok(result.gate, "gate should be present");
  assert.ok(result.meta, "meta should be present");
  assert.ok(typeof result.meta.durationMs === "number", "durationMs should be a number");
  assert.equal(result.meta.orgId, "cfm", "orgId should be in meta");

  delete process.env.WIKI_VAULT_CFM;
});

test("queryWiki accepts optional parameters", async () => {
  process.env.WIKI_VAULT_CFM = "/nonexistent/vault/cfm";

  // Test that options are accepted without error.
  const result = await queryWiki("cfm", "test query", { k: 10, floor: 0.5 });

  assert.ok(result, "Should handle options without error");

  delete process.env.WIKI_VAULT_CFM;
});
