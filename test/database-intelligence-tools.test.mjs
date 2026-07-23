import assert from "node:assert/strict";
import test from "node:test";
import {
  databaseCatalogStatusTool,
  databaseCompareTool,
  databaseDescribeTool,
  databaseIntelligenceTools,
  databaseRelationsTool,
  databaseSearchTool,
} from "../dist/eve/database-intelligence-tools.js";

function toolContext(token = "v1.identity.payload") {
  return {
    session: {
      auth: {
        current: token
          ? {
              attributes: { impelIdentityRunToken: token },
              authenticator: "test",
              principalId: "caller",
              principalType: "service",
            }
          : null,
        initiator: null,
      },
    },
    async getSandbox() {
      throw new Error("sandbox should not be used");
    },
  };
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("exports the complete opt-in database-intelligence tool set", () => {
  assert.deepEqual(Object.keys(databaseIntelligenceTools), [
    "database_catalog_status",
    "database_search",
    "database_describe",
    "database_relations",
    "database_compare",
  ]);
});

test("derives all service identity from signed session auth", async () => {
  const originalUrl = process.env.IMPEL_CODE_INTELLIGENCE_URL;
  const originalFetch = globalThis.fetch;
  try {
    process.env.IMPEL_CODE_INTELLIGENCE_URL = "https://code.example/base/";
    const calls = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return Response.json({ ok: true });
    };

    await databaseCatalogStatusTool.execute({}, toolContext());
    await databaseSearchTool.execute({ query: "Account TemplateId", limit: 25 }, toolContext());
    await databaseDescribeTool.execute({ database: "primary", qualifiedName: "dbo.Account" }, toolContext());
    await databaseRelationsTool.execute({ objectId: "obj_1", direction: "both", maxDepth: 2, limit: 100 }, toolContext());
    await databaseCompareTool.execute({ leftDatabase: "primary", rightDatabase: "replica", limit: 200 }, toolContext());

    assert.deepEqual(calls.map((call) => call.url), [
      "https://code.example/v1/database/catalog-status",
      "https://code.example/v1/database/search",
      "https://code.example/v1/database/describe",
      "https://code.example/v1/database/relations",
      "https://code.example/v1/database/compare",
    ]);
    for (const call of calls) {
      assert.equal(call.init.headers["x-impel-run-token"], "v1.identity.payload");
      assert.equal("authorization" in call.init.headers, false);
      const body = JSON.parse(call.init.body);
      assert.equal("orgId" in body, false);
      assert.equal("runId" in body, false);
      assert.equal("agentId" in body, false);
      assert.equal("catalogId" in body, false);
    }
    assert.deepEqual(JSON.parse(calls[0].init.body), {});
  } finally {
    restoreEnv("IMPEL_CODE_INTELLIGENCE_URL", originalUrl);
    globalThis.fetch = originalFetch;
  }
});

test("fails closed before network access without a signed session assertion", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls += 1;
      return Response.json({ ok: true });
    };
    const result = await databaseSearchTool.execute({ query: "Account", limit: 25 }, toolContext(null));
    assert.equal(result.ok, false);
    assert.match(result.error.message, /no server-authenticated/i);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
