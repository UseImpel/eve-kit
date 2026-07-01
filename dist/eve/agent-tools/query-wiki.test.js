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
test("queryWiki missing wiki returns gracefully", async () => {
    const result = await queryWiki("tenant-alpha", "payroll policy", {
        vaultResolver: {
            "tenant-alpha": "/nonexistent/vault/tenant-alpha",
        },
    });
    assert.equal(result.chunks.length, 0, "Missing wiki should return empty chunks");
    assert.equal(result.gate.gated, true, "Gate should be gated on empty results");
    assert.equal(result.gate.reason, "no_results", "Reason should be no_results");
    assert.equal(result.meta.orgId, "tenant-alpha", "Meta should include orgId");
    assert.ok(result.meta.durationMs >= 0, "Meta should include durationMs");
});
test("queryWiki result has required structure", async () => {
    const result = await queryWiki("tenant-alpha", "test", {
        vaultResolver: () => "/nonexistent/vault/tenant-alpha",
    });
    // Even with empty chunks, the structure should be valid.
    assert.ok(Array.isArray(result.chunks), "chunks should be an array");
    assert.ok(result.gate, "gate should be present");
    assert.ok(result.meta, "meta should be present");
    assert.ok(typeof result.meta.durationMs === "number", "durationMs should be a number");
    assert.equal(result.meta.orgId, "tenant-alpha", "orgId should be in meta");
});
test("queryWiki accepts optional parameters", async () => {
    const result = await queryWiki("tenant-alpha", "test query", {
        k: 10,
        floor: 0.5,
        vaultResolver: () => "/nonexistent/vault/tenant-alpha",
    });
    assert.ok(result, "Should handle options without error");
});
//# sourceMappingURL=query-wiki.test.js.map