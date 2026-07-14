import assert from "node:assert/strict";
import test from "node:test";
import {
  codeIntelligenceTools,
  codeReadTool,
  codeSearchTool,
  codeWorkspaceStatusTool,
} from "../dist/eve/code-intelligence-tools.js";

const exactContext = {
  orgId: "impel",
  runId: "run_123",
  codeIntelligence: {
    workspaceId: "ws_123",
    repositories: [
      {
        provider: "github",
        providerRepoId: "987",
        repoFullName: "UseImpel/next",
        commitSha: "abcdef0123456789abcdef0123456789abcdef01",
        requestedRef: "main",
      },
    ],
  },
};

function toolContext(metadata = exactContext) {
  return {
    channel: { metadata },
    async getSandbox() {
      throw new Error("sandbox fallback should not be used");
    },
  };
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("exports the complete opt-in code-intelligence tool set", () => {
  assert.deepEqual(Object.keys(codeIntelligenceTools), [
    "code_workspace_status",
    "code_read",
    "code_search",
    "code_context",
    "code_impact",
    "code_trace",
    "code_diff_impact",
  ]);
});

test("binds workspace and exact repository identity outside model input", async () => {
  const originalUrl = process.env.IMPEL_CODE_INTELLIGENCE_URL;
  const originalKey = process.env.IMPEL_CODE_INTELLIGENCE_RUNTIME_API_KEY;
  const originalFetch = globalThis.fetch;
  try {
    process.env.IMPEL_CODE_INTELLIGENCE_URL = "https://code.example/base/";
    process.env.IMPEL_CODE_INTELLIGENCE_RUNTIME_API_KEY = "runtime-secret";
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://code.example/v1/code/read");
      assert.equal(init.method, "POST");
      assert.equal(init.headers.authorization, "Bearer runtime-secret");
      assert.equal(init.headers["x-impel-org-id"], "impel");
      assert.equal(init.headers["x-impel-run-id"], "run_123");
      assert.deepEqual(JSON.parse(init.body), {
        workspaceId: "ws_123",
        providerRepoId: "987",
        commitSha: "abcdef0123456789abcdef0123456789abcdef01",
        path: "src/app.ts",
        startLine: 10,
        endLine: 20,
      });
      return Response.json({ ok: true, content: "const value = 1;" });
    };

    assert.deepEqual(
      await codeReadTool.execute(
        { path: "src/app.ts", startLine: 10, endLine: 20 },
        toolContext(),
      ),
      { ok: true, content: "const value = 1;" },
    );
  } finally {
    restoreEnv("IMPEL_CODE_INTELLIGENCE_URL", originalUrl);
    restoreEnv("IMPEL_CODE_INTELLIGENCE_RUNTIME_API_KEY", originalKey);
    globalThis.fetch = originalFetch;
  }
});

test("workspace status does not accept model-selected repository identity", async () => {
  const originalUrl = process.env.IMPEL_CODE_INTELLIGENCE_URL;
  const originalKey = process.env.IMPEL_CODE_INTELLIGENCE_RUNTIME_API_KEY;
  const originalFetch = globalThis.fetch;
  try {
    process.env.IMPEL_CODE_INTELLIGENCE_URL = "https://code.example";
    process.env.IMPEL_CODE_INTELLIGENCE_RUNTIME_API_KEY = "runtime-secret";
    globalThis.fetch = async (_input, init) => {
      assert.deepEqual(JSON.parse(init.body), { workspaceId: "ws_123" });
      return Response.json({ ok: true });
    };
    assert.deepEqual(
      await codeWorkspaceStatusTool.execute({}, toolContext()),
      { ok: true },
    );
  } finally {
    restoreEnv("IMPEL_CODE_INTELLIGENCE_URL", originalUrl);
    restoreEnv("IMPEL_CODE_INTELLIGENCE_RUNTIME_API_KEY", originalKey);
    globalThis.fetch = originalFetch;
  }
});

test("fails closed before network access for missing or out-of-scope context", async () => {
  const originalUrl = process.env.IMPEL_CODE_INTELLIGENCE_URL;
  const originalKey = process.env.IMPEL_CODE_INTELLIGENCE_RUNTIME_API_KEY;
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  try {
    process.env.IMPEL_CODE_INTELLIGENCE_URL = "https://code.example";
    process.env.IMPEL_CODE_INTELLIGENCE_RUNTIME_API_KEY = "runtime-secret";
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return Response.json({ ok: true });
    };

    const missing = await codeSearchTool.execute(
      { mode: "text", query: "token", limit: 20 },
      toolContext({ orgId: "impel", runId: "run_123" }),
    );
    assert.equal(missing.ok, false);
    assert.match(missing.error.message, /No server-prepared/);

    const outside = await codeSearchTool.execute(
      {
        repository: "OtherOrg/private",
        mode: "text",
        query: "token",
        limit: 20,
      },
      toolContext(),
    );
    assert.equal(outside.ok, false);
    assert.match(outside.error.message, /outside this exact workspace/);
    assert.equal(fetchCalls, 0);
  } finally {
    restoreEnv("IMPEL_CODE_INTELLIGENCE_URL", originalUrl);
    restoreEnv("IMPEL_CODE_INTELLIGENCE_RUNTIME_API_KEY", originalKey);
    globalThis.fetch = originalFetch;
  }
});
