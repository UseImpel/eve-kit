import { test } from "node:test";
import assert from "node:assert/strict";
import { queryWiki, resolveWikiVault } from "./query-wiki.js";

test("resolveWikiVault uses an injected resolver function", () => {
  const vault = resolveWikiVault("tenant-alpha", {
    vaultResolver: (orgId) => ({ path: `custom-vaults/${orgId}` }),
  });

  assert.equal(vault, "custom-vaults/tenant-alpha");
});

test("resolveWikiVault uses an injected config map", () => {
  const vault = resolveWikiVault("tenant-beta", {
    vaultResolver: {
      "tenant-beta": "/tmp/wiki-vaults/tenant-beta",
    },
  });

  assert.equal(vault, "/tmp/wiki-vaults/tenant-beta");
});

test("resolveWikiVault reads IMPEL_WIKI_VAULT_MAP", () => {
  const vault = resolveWikiVault("tenant-gamma", {
    env: {
      IMPEL_WIKI_VAULT_MAP: JSON.stringify({
        "tenant-gamma": { path: "/tmp/wiki-vaults/tenant-gamma" },
      }),
    },
  });

  assert.equal(vault, "/tmp/wiki-vaults/tenant-gamma");
});

test("resolveWikiVault falls back to the org convention", () => {
  const vault = resolveWikiVault("tenant-delta", { env: {} });
  assert.equal(vault, "wikis/tenant-delta");
});

// A wiki whose manifest can't be loaded must FAIL, not answer. The old
// behaviour (empty chunks + gated: no_results) was indistinguishable from a
// healthy wiki that doesn't cover the query, so agents kept answering as if
// the wiki were empty — the frozen-index bug family.
test("queryWiki throws loudly when the wiki manifest is missing", async () => {
  await assert.rejects(
    queryWiki("tenant-alpha", "payroll policy", {
      vaultResolver: {
        "tenant-alpha": "/nonexistent/vault/tenant-alpha",
      },
    }),
    /manifest v2 not found/
  );
});

test("queryWiki propagates the manifest error with optional parameters set", async () => {
  await assert.rejects(
    queryWiki("tenant-alpha", "test query", {
      k: 10,
      floor: 0.5,
      vaultResolver: () => "/nonexistent/vault/tenant-alpha",
    }),
    /manifest v2 not found/
  );
});
