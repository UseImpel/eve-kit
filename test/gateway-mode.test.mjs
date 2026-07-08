import assert from "node:assert/strict";
import test from "node:test";
import { buildGatewayClaudeCodeSettings } from "../dist/eve/gateway-model.js";
import { createImpelClaudeModel } from "../dist/eve/model.js";

const ENV_KEYS = [
  "IMPEL_GATEWAY_URL",
  "IMPEL_GATEWAY_PAT",
  "IMPEL_INFERENCE_URL",
  "IMPEL_INFERENCE_API_KEY",
  "IMPEL_ORG_ID",
];

function restoreEnvSnapshot() {
  const previous = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function sse(parts) {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const part of parts) {
        controller.enqueue(
          encoder.encode(
            `data: ${typeof part === "string" ? part : JSON.stringify(part)}\n\n`,
          ),
        );
      }
      controller.close();
    },
  });
}

function finishPart() {
  return {
    type: "finish",
    finishReason: { unified: "stop", raw: "completed" },
    usage: {
      inputTokens: {},
      outputTokens: {},
    },
    providerMetadata: {
      "claude-code": { terminalReason: "completed" },
    },
  };
}

test("builds Claude Code settings for impel-gateway", () => {
  const settings = buildGatewayClaudeCodeSettings({
    gatewayUrl: "https://gateway.useimpel.com/",
    pat: "impel_pat_test",
    configDir: "/tmp/impel-gateway-test",
    providerOptions: {
      env: {
        KEEP_ME: "1",
        DROP_ME: 1,
        ANTHROPIC_API_KEY: "old-key",
      },
      "claude-code": {
        effort: "xhigh",
        maxTurns: 3,
        allowedTools: ["Read"],
      },
      anthropic: {
        disallowedTools: ["Bash"],
        forwardSubagentText: true,
      },
    },
  });

  assert.equal(
    settings.env?.ANTHROPIC_BASE_URL,
    "https://gateway.useimpel.com/anthropic",
  );
  assert.equal(settings.env?.ANTHROPIC_AUTH_TOKEN, "impel_pat_test");
  assert.equal(settings.env?.ANTHROPIC_API_KEY, undefined);
  assert.equal(settings.env?.CLAUDE_CODE_OAUTH_TOKEN, undefined);
  assert.equal(settings.env?.CLAUDE_CONFIG_DIR, "/tmp/impel-gateway-test");
  assert.equal(settings.env?.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST, "1");
  assert.equal(settings.env?.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB, "0");
  assert.equal(settings.env?.CLAUDE_CODE_DISABLE_AUTO_MEMORY, "1");
  assert.equal(settings.env?.DISABLE_LOGIN_COMMAND, "1");
  assert.equal(settings.env?.DISABLE_LOGOUT_COMMAND, "1");
  assert.equal(settings.env?.KEEP_ME, "1");
  assert.equal("DROP_ME" in settings.env, false);
  assert.equal(settings.effort, "high");
  assert.equal(settings.maxTurns, 3);
  assert.deepEqual(settings.allowedTools, ["Read"]);
  assert.deepEqual(settings.disallowedTools, ["Bash"]);
  assert.equal(settings.forwardSubagentText, true);
  assert.deepEqual(settings.settingSources, []);
});

test("createImpelClaudeModel uses gateway env when configured", () => {
  const restoreEnv = restoreEnvSnapshot();
  try {
    process.env.IMPEL_GATEWAY_URL = "https://gateway.example/";
    process.env.IMPEL_GATEWAY_PAT = "impel_pat_env";
    delete process.env.IMPEL_INFERENCE_URL;
    delete process.env.IMPEL_INFERENCE_API_KEY;

    const model = createImpelClaudeModel({ modelId: "sonnet" });

    assert.equal(model.provider, "claude-code");
    assert.equal(
      model.settings.env.ANTHROPIC_BASE_URL,
      "https://gateway.example/anthropic",
    );
    assert.equal(model.settings.env.ANTHROPIC_AUTH_TOKEN, "impel_pat_env");
    assert.match(
      model.settings.env.CLAUDE_CONFIG_DIR,
      /^\/tmp\/impel-gateway-claude\//,
    );
  } finally {
    restoreEnv();
  }
});

test("createImpelClaudeModel keeps impel-inference path when gateway env is unset", async () => {
  const restoreEnv = restoreEnvSnapshot();
  const previousFetch = globalThis.fetch;
  const requests = [];

  try {
    delete process.env.IMPEL_GATEWAY_URL;
    delete process.env.IMPEL_GATEWAY_PAT;
    process.env.IMPEL_INFERENCE_URL = "https://inference.example";
    process.env.IMPEL_INFERENCE_API_KEY = "secret";
    process.env.IMPEL_ORG_ID = "org_gateway_test";
    globalThis.fetch = async (url, init = {}) => {
      requests.push({ url: String(url), init });
      return new Response(
        sse([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "txt" },
          { type: "text-delta", id: "txt", delta: "hosted" },
          { type: "text-end", id: "txt" },
          finishPart(),
          "[DONE]",
        ]),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    };

    const model = createImpelClaudeModel({ modelId: "claude-opus-4-8" });
    await model.doGenerate({ prompt: [] });

    assert.equal(model.provider, "impel-inference");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://inference.example/v1/model/stream");
    const body = JSON.parse(String(requests[0].init.body));
    assert.equal(body.provider, "claude-code");
    assert.equal(body.modelId, "claude-opus-4-8");
    assert.equal(body.orgId, "org_gateway_test");
    assert.equal("gatewayUrl" in body, false);
    assert.equal("gatewayPat" in body, false);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv();
  }
});
