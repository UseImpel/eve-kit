import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGatewayAnthropicProviderSettings,
  buildGatewayClaudeCodeSettings,
  buildGatewayCodexAppServerSettings,
} from "../dist/eve/gateway-model.js";
import {
  createImpelClaudeModel,
  createImpelCodexModel,
} from "../dist/eve/model.js";

const ENV_KEYS = [
  "IMPEL_GATEWAY_URL",
  "IMPEL_GATEWAY_AUTH_TOKEN",
  "IMPEL_GATEWAY_PAT",
  "IMPEL_GATEWAY_API_KEY",
  "IMPEL_RUN_TOKEN",
  "IMPEL_PAT",
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

test("builds Anthropic provider settings for impel-gateway", () => {
  const settings = buildGatewayAnthropicProviderSettings({
    gatewayUrl: "https://gateway.useimpel.com/",
    authToken: "impel_pat_test",
    headers: { "x-test": "1" },
  });

  assert.equal(settings.baseURL, "https://gateway.useimpel.com/anthropic/v1");
  assert.equal(settings.authToken, "impel_pat_test");
  assert.deepEqual(settings.headers, { "x-test": "1" });
  assert.equal(settings.name, "anthropic.impel-gateway");
});

test("createImpelClaudeModel uses gateway env when configured", () => {
  const restoreEnv = restoreEnvSnapshot();
  try {
    process.env.IMPEL_GATEWAY_URL = "https://gateway.example/";
    process.env.IMPEL_GATEWAY_PAT = "impel_pat_env";
    delete process.env.IMPEL_INFERENCE_URL;
    delete process.env.IMPEL_INFERENCE_API_KEY;

    const model = createImpelClaudeModel({ modelId: "sonnet" });

    assert.equal(model.provider, "anthropic.impel-gateway");
    assert.equal(model.modelId, "sonnet");
    assert.equal(model.specificationVersion, "v4");
  } finally {
    restoreEnv();
  }
});

test("gateway Claude model forwards AI SDK tools to Anthropic Messages", async () => {
  const restoreEnv = restoreEnvSnapshot();
  const previousFetch = globalThis.fetch;
  const requests = [];

  try {
    process.env.IMPEL_GATEWAY_URL = "https://gateway.example/";
    process.env.IMPEL_GATEWAY_PAT = "impel_pat_env";
    delete process.env.IMPEL_INFERENCE_URL;
    delete process.env.IMPEL_INFERENCE_API_KEY;

    globalThis.fetch = async (url, init = {}) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-4-8",
          content: [{ type: "text", text: "ready" }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const model = createImpelClaudeModel({ modelId: "claude-opus-4-8" });
    await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "query" }] }],
      tools: [
        {
          type: "function",
          name: "execute_query",
          description: "Run a read-only SQL query",
          inputSchema: {
            type: "object",
            properties: { sql: { type: "string" } },
            required: ["sql"],
            additionalProperties: false,
          },
        },
      ],
    });

    assert.equal(requests.length, 1);
    assert.equal(
      requests[0].url,
      "https://gateway.example/anthropic/v1/messages",
    );
    const headers = Object.fromEntries(
      new Headers(requests[0].init.headers).entries(),
    );
    assert.equal(headers.authorization, "Bearer impel_pat_env");
    const body = JSON.parse(String(requests[0].init.body));
    assert.equal(body.model, "claude-opus-4-8");
    assert.equal(body.tools?.[0]?.name, "execute_query");
    assert.equal(body.tools?.[0]?.input_schema?.properties?.sql?.type, "string");
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv();
  }
});

test("gateway Claude model uses packed Eve clientContext run token", async () => {
  const restoreEnv = restoreEnvSnapshot();
  const previousFetch = globalThis.fetch;
  const requests = [];

  try {
    process.env.IMPEL_GATEWAY_URL = "https://gateway.example/";
    delete process.env.IMPEL_GATEWAY_AUTH_TOKEN;
    delete process.env.IMPEL_GATEWAY_PAT;
    delete process.env.IMPEL_GATEWAY_API_KEY;
    delete process.env.IMPEL_RUN_TOKEN;
    delete process.env.IMPEL_PAT;
    delete process.env.IMPEL_INFERENCE_URL;
    delete process.env.IMPEL_INFERENCE_API_KEY;

    globalThis.fetch = async (url, init = {}) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-4-8",
          content: [{ type: "text", text: "ready" }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const runToken = "impel_run_token_packed";
    const model = createImpelClaudeModel({ modelId: "claude-opus-4-8" });
    await model.doGenerate({
      prompt: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Client context:\n${JSON.stringify({
                orgId: "impel",
                runId: "run_packed",
                runToken,
              })}`,
            },
            { type: "text", text: "Reply briefly: ready." },
          ],
        },
      ],
    });

    assert.equal(requests.length, 1);
    const headers = Object.fromEntries(
      new Headers(requests[0].init.headers).entries(),
    );
    assert.equal(headers.authorization, `Bearer ${runToken}`);
    assert.equal(String(requests[0].init.body).includes(runToken), false);
    assert.equal(
      String(requests[0].init.body).includes("<impel-run-token>"),
      true,
    );
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv();
  }
});

test("builds Codex app-server settings for impel-gateway", () => {
  const settings = buildGatewayCodexAppServerSettings({
    gatewayUrl: "https://gateway.useimpel.com/",
    authToken: "impel_pat_test",
    orgId: "org_123",
    runId: "run_123",
    codexHomeRoot: "/tmp/impel-codex-test",
    providerOptions: {
      env: {
        KEEP_ME: "1",
        DROP_ME: 1,
      },
      "codex-app-server": {
        approvalPolicy: "never",
        sandboxPolicy: "workspace-write",
        effort: "high",
      },
    },
  });

  assert.equal(settings.env.CODEX_HOME, "/tmp/impel-codex-test/org_123/run_123");
  assert.equal(settings.env.IMPEL_GATEWAY_AUTH_TOKEN, "impel_pat_test");
  assert.equal(settings.env.KEEP_ME, "1");
  assert.equal("DROP_ME" in settings.env, false);
  assert.equal(settings.approvalPolicy, "never");
  assert.equal(settings.sandboxPolicy, "workspace-write");
  assert.equal(settings.effort, "high");
  assert.equal(settings.configOverrides.model_provider, "impel");
  assert.equal(
    settings.configOverrides.model_providers.impel.base_url,
    "https://gateway.useimpel.com/chatgpt_passthrough/backend-api/codex",
  );
  assert.equal(
    settings.configOverrides.model_providers.impel.auth.args[1],
    "process.stdout.write((process.env.IMPEL_GATEWAY_AUTH_TOKEN || '') + '\\n')",
  );
});

test("createImpelCodexModel uses gateway env when configured", () => {
  const restoreEnv = restoreEnvSnapshot();
  try {
    process.env.IMPEL_GATEWAY_URL = "https://gateway.example/";
    process.env.IMPEL_GATEWAY_AUTH_TOKEN = "impel_pat_env";
    delete process.env.IMPEL_INFERENCE_URL;
    delete process.env.IMPEL_INFERENCE_API_KEY;

    const model = createImpelCodexModel({ modelId: "gpt-5.5" });

    assert.equal(model.provider, "impel-gateway");
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
