import assert from "node:assert/strict";
import test from "node:test";
import { impelInference } from "../dist/index.js";
import {
  createImpelClaudeModel,
  createImpelCodexModel,
} from "../dist/eve/model.js";

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

function rawSse(text) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function promptWithClientContext(context) {
  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Client context:\n${JSON.stringify(context)}`,
        },
      ],
    },
  ];
}

async function readStreamParts(model, options = { prompt: [] }) {
  const { stream } = await model.doStream(options);
  const reader = stream.getReader();
  const parts = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return parts;
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

test("impelInference uses hosted model stream by default", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });

    assert.equal(String(url), "https://infer.example/v1/model/stream");
    const body = JSON.parse(String(init.body));
    assert.equal(body.provider, "claude-code");
    assert.equal(body.modelId, "claude-opus-4-8");
    assert.equal(body.orgId, "org_default");
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

  try {
    const model = impelInference("claude-opus-4-8", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_default",
    });

    const result = await model.doGenerate({ prompt: [] });

    assert.equal(result.content[0].type, "text");
    assert.equal(result.content[0].text, "hosted");
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("forwards Eve tool call options to hosted model stream", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  const tools = [
    {
      type: "function",
      name: "render_ui",
      description: "Render a UI payload.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "researcher",
      description: "Delegate to the researcher subagent.",
      inputSchema: {
        type: "object",
        properties: {
          message: { type: "string" },
          outputSchema: { type: "object" },
        },
        required: ["message"],
        additionalProperties: false,
      },
    },
  ];

  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });

    assert.equal(String(url), "https://infer.example/v1/model/stream");
    const body = JSON.parse(String(init.body));
    assert.deepEqual(body.callOptions.tools, tools);
    assert.deepEqual(body.callOptions.toolChoice, {
      type: "tool",
      toolName: "render_ui",
    });
    assert.equal("abortSignal" in body.callOptions, false);
    return new Response(
      sse([
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "txt" },
        { type: "text-delta", id: "txt", delta: "tool-ready" },
        { type: "text-end", id: "txt" },
        finishPart(),
        "[DONE]",
      ]),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );
  };

  try {
    const model = impelInference("claude-opus-4-8", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_default",
    });

    const parts = await readStreamParts(model, {
      prompt: [],
      tools,
      toolChoice: { type: "tool", toolName: "render_ui" },
      abortSignal: new AbortController().signal,
    });

    assert.equal(
      parts.find((part) => part.type === "text-delta")?.delta,
      "tool-ready",
    );
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("model-stream transport forwards tools and toolChoice in callOptions", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });

    return new Response(
      sse([{ type: "stream-start", warnings: [] }, finishPart(), "[DONE]"]),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );
  };

  const tool = {
    type: "function",
    name: "echo",
    description: "Echo a value",
    inputSchema: {
      type: "object",
      properties: { value: { type: "string" } },
      required: ["value"],
      additionalProperties: false,
    },
  };
  const toolChoice = { type: "tool", toolName: "echo" };

  try {
    const model = impelInference("claude-opus-4-8", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_tools",
    });

    const { stream } = await model.doStream({
      prompt: [],
      tools: [tool],
      toolChoice,
      temperature: 0.2,
    });
    await stream.cancel();

    assert.equal(requests.length, 1);
    const body = JSON.parse(String(requests[0].init.body));
    assert.deepEqual(body.callOptions.tools, [tool]);
    assert.deepEqual(body.callOptions.toolChoice, toolChoice);
    assert.equal(body.callOptions.temperature, 0.2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("model-stream transport does not serialize abortSignal or per-call headers", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });

    return new Response(
      sse([{ type: "stream-start", warnings: [] }, finishPart(), "[DONE]"]),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );
  };

  try {
    const model = impelInference("claude-opus-4-8", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_tools",
    });

    const { stream } = await model.doStream({
      prompt: [],
      temperature: 0.4,
      abortSignal: AbortSignal.timeout(1_000),
      headers: { "x-should-not-forward": "1" },
    });
    await stream.cancel();

    const body = JSON.parse(String(requests[0].init.body));
    assert.equal(body.callOptions.temperature, 0.4);
    assert.equal("abortSignal" in body.callOptions, false);
    assert.equal("headers" in body.callOptions, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("doGenerate surfaces hosted tool-call stream parts", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      sse([
        { type: "stream-start", warnings: [] },
        {
          type: "tool-call",
          toolCallId: "call_1",
          toolName: "echo",
          input: { value: "ok" },
        },
        finishPart(),
        "[DONE]",
      ]),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );

  try {
    const model = impelInference("claude-opus-4-8", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_tools",
    });

    const result = await model.doGenerate({ prompt: [] });

    assert.deepEqual(result.content, [
      {
        type: "tool-call",
        toolCallId: "call_1",
        toolName: "echo",
        input: { value: "ok" },
      },
    ]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("workflow transport streams from /start and forwards auth, trace headers, and Eve clientContext", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });

    if (String(url).endsWith("/v1/infer/start")) {
      const body = JSON.parse(String(init.body));
      assert.equal(init.headers.authorization, "Bearer secret");
      assert.equal(init.headers.traceparent, "00-test");
      assert.equal(init.headers["x-org-id"], "org_prompt");
      assert.equal(init.headers["x-impel-org-id"], "org_prompt");
      assert.equal(init.headers["content-type"], "application/json");
      assert.equal(body.orgId, "org_prompt");
      assert.deepEqual(body.repos, ["UseImpel/next"]);
      assert.equal(body.branch, "main");
      assert.equal(body.installationId, "123");
      assert.equal(body.trace.traceId, "trace_1");
      assert.equal(body.providerOptions.permissionMode, "bypassPermissions");
      return new Response(
        JSON.stringify({
          runId: "run_1",
          streamUrl: "/v1/infer/runs/run_1/stream?startIndex=0&orgId=org_prompt",
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      );
    }

    if (
      String(url).endsWith(
        "/v1/infer/runs/run_1/stream?startIndex=0&orgId=org_prompt",
      )
    ) {
      return new Response(
        sse([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "txt" },
          { type: "text-delta", id: "txt", delta: "ready" },
          { type: "text-end", id: "txt" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "completed" },
            usage: {
              inputTokens: {},
              outputTokens: {},
            },
            providerMetadata: {
              "claude-code": { terminalReason: "completed" },
            },
          },
          "[DONE]",
        ]),
        {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "x-workflow-run-id": "run_1",
          },
        },
      );
    }

    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const model = impelInference("claude-opus-4-8", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_default",
      transport: "workflow",
      providerOptions: { permissionMode: "bypassPermissions" },
      headers: () => ({ traceparent: "00-test", authorization: "ignored" }),
    });

    const result = await model.doGenerate({
      prompt: promptWithClientContext({
        orgId: "org_prompt",
        repos: ["UseImpel/next"],
        branch: "main",
        installationId: 123,
        traceId: "trace_1",
      }),
    });

    assert.equal(result.content[0].type, "text");
    assert.equal(result.content[0].text, "ready");
    assert.equal(result.finishReason.unified, "stop");
    assert.equal(requests.length, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("filters reasoning stream parts by default", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/v1/infer/start")) {
      return new Response(
        JSON.stringify({
          runId: "run_reasoning",
          streamUrl:
            "/v1/infer/runs/run_reasoning/stream?startIndex=0&orgId=org_default",
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      );
    }

    if (
      String(url).endsWith(
        "/v1/infer/runs/run_reasoning/stream?startIndex=0&orgId=org_default",
      )
    ) {
      return new Response(
        sse([
          { type: "stream-start", warnings: [] },
          { type: "reasoning-start", id: "rsn" },
          { type: "reasoning-delta", id: "rsn", delta: "thinking" },
          { type: "reasoning-end", id: "rsn" },
          { type: "text-start", id: "txt" },
          { type: "text-delta", id: "txt", delta: "ready" },
          { type: "text-end", id: "txt" },
          finishPart(),
          "[DONE]",
        ]),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    }

    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const model = impelInference("claude-opus-4-8", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_default",
      transport: "workflow",
    });

    const parts = await readStreamParts(model);
    assert.deepEqual(
      parts.map((part) => part.type),
      ["stream-start", "text-start", "text-delta", "text-end", "finish"],
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("can opt in to forwarding reasoning stream parts", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/v1/infer/start")) {
      return new Response(
        JSON.stringify({
          runId: "run_reasoning_opt_in",
          streamUrl:
            "/v1/infer/runs/run_reasoning_opt_in/stream?startIndex=0&orgId=org_default",
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      );
    }

    if (
      String(url).endsWith(
        "/v1/infer/runs/run_reasoning_opt_in/stream?startIndex=0&orgId=org_default",
      )
    ) {
      return new Response(
        sse([
          { type: "stream-start", warnings: [] },
          { type: "reasoning-start", id: "rsn" },
          { type: "reasoning-delta", id: "rsn", delta: "thinking" },
          { type: "reasoning-end", id: "rsn" },
          { type: "text-start", id: "txt" },
          { type: "text-delta", id: "txt", delta: "ready" },
          { type: "text-end", id: "txt" },
          finishPart(),
          "[DONE]",
        ]),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    }

    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const model = impelInference("claude-opus-4-8", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_default",
      transport: "workflow",
      streamReasoning: true,
    });

    const parts = await readStreamParts(model);
    assert.deepEqual(
      parts.map((part) => part.type),
      [
        "stream-start",
        "reasoning-start",
        "reasoning-delta",
        "reasoning-end",
        "text-start",
        "text-delta",
        "text-end",
        "finish",
      ],
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("fails locally when no inference api key is configured", async () => {
  const model = impelInference("claude-opus-4-8", {
    baseUrl: "https://infer.example",
  });

  await assert.rejects(
    () => model.doStream({ prompt: [] }),
    /IMPEL_INFERENCE_API_KEY is required/,
  );
});

test("createImpelCodexModel uses hosted model stream by default", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });

    if (String(url).endsWith("/v1/model/stream")) {
      const body = JSON.parse(String(init.body));
      assert.equal(body.provider, "codex-app-server");
      assert.equal(body.modelId, "gpt-5.5");
      assert.equal(body.orgId, "org_codex");
      assert.equal(body.providerOptions.approvalMode, "never");
      assert.equal(body.providerOptions.sandboxMode, "workspace-write");
      assert.equal(body.providerOptions.skipGitRepoCheck, true);
      assert.equal(body.providerOptions.reasoningEffort, "high");
      return new Response(
        sse([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "txt" },
          { type: "text-delta", id: "txt", delta: "coded" },
          { type: "text-end", id: "txt" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "completed" },
            usage: {
              inputTokens: {},
              outputTokens: {},
            },
            providerMetadata: {
              "codex-app-server": { terminalReason: "completed" },
            },
          },
          "[DONE]",
        ]),
        {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "x-workflow-run-id": "run_codex",
          },
        },
      );
    }

    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const model = createImpelCodexModel({
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_codex",
      providerOptions: { reasoningEffort: "high" },
    });

    const result = await model.doGenerate({ prompt: [] });

    assert.equal(result.content[0].type, "text");
    assert.equal(result.content[0].text, "coded");
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("createImpelCodexModel can still use durable workflow transport", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });

    if (String(url).endsWith("/v1/infer/start")) {
      const body = JSON.parse(String(init.body));
      assert.equal(body.provider, "codex-cli");
      assert.equal(body.modelId, "gpt-5.5");
      assert.equal(body.orgId, "org_codex");
      return new Response(
        JSON.stringify({
          runId: "run_codex",
          streamUrl: "/v1/infer/runs/run_codex/stream?startIndex=0&orgId=org_codex",
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      );
    }

    if (
      String(url).endsWith(
        "/v1/infer/runs/run_codex/stream?startIndex=0&orgId=org_codex",
      )
    ) {
      return new Response(
        sse([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "txt" },
          { type: "text-delta", id: "txt", delta: "coded" },
          { type: "text-end", id: "txt" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "completed" },
            usage: {
              inputTokens: {},
              outputTokens: {},
            },
            providerMetadata: {
              "codex-cli": { terminalReason: "completed" },
            },
          },
          "[DONE]",
        ]),
        {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "x-workflow-run-id": "run_codex",
          },
        },
      );
    }

    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const model = createImpelCodexModel({
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_codex",
      transport: "workflow",
    });

    const result = await model.doGenerate({ prompt: [] });

    assert.equal(result.content[0].type, "text");
    assert.equal(result.content[0].text, "coded");
    assert.equal(requests.length, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("createImpelClaudeModel requires impel-inference in production", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousUrl = process.env.IMPEL_INFERENCE_URL;
  const previousAllow = process.env.IMPEL_ALLOW_LOCAL_PROVIDER_FALLBACK;
  process.env.NODE_ENV = "production";
  delete process.env.IMPEL_INFERENCE_URL;
  delete process.env.IMPEL_ALLOW_LOCAL_PROVIDER_FALLBACK;

  try {
    assert.throws(
      () => createImpelClaudeModel(),
      /IMPEL_INFERENCE_URL or baseUrl is required/,
    );
    assert.doesNotThrow(() =>
      createImpelClaudeModel({ allowLocalProviderFallback: true }),
    );
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    if (previousUrl === undefined) {
      delete process.env.IMPEL_INFERENCE_URL;
    } else {
      process.env.IMPEL_INFERENCE_URL = previousUrl;
    }
    if (previousAllow === undefined) {
      delete process.env.IMPEL_ALLOW_LOCAL_PROVIDER_FALLBACK;
    } else {
      process.env.IMPEL_ALLOW_LOCAL_PROVIDER_FALLBACK = previousAllow;
    }
  }
});

test("createImpelClaudeModel uses hosted model-stream transport by default", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.IMPEL_INFERENCE_URL;
  const previousKey = process.env.IMPEL_INFERENCE_API_KEY;
  const previousOrg = process.env.IMPEL_ORG_ID;
  const previousTransport = process.env.IMPEL_CLAUDE_TRANSPORT;

  process.env.IMPEL_INFERENCE_URL = "https://inference.test";
  process.env.IMPEL_INFERENCE_API_KEY = "secret";
  process.env.IMPEL_ORG_ID = "org_env";
  delete process.env.IMPEL_CLAUDE_TRANSPORT;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    assert.equal(String(url), "https://inference.test/v1/model/stream");
    assert.equal(init.headers.authorization, "Bearer secret");
    const body = JSON.parse(String(init.body));
    assert.equal(body.provider, "claude-code");
    assert.equal(body.modelId, "claude-sonnet-4-5");
    assert.equal(body.orgId, "org_env");
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

  try {
    const model = createImpelClaudeModel({ modelId: "claude-sonnet-4-5" });
    const parts = await readStreamParts(model);

    assert.equal(requests.length, 1);
    assert.equal(
      parts.find((part) => part.type === "text-delta")?.delta,
      "hosted",
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) {
      delete process.env.IMPEL_INFERENCE_URL;
    } else {
      process.env.IMPEL_INFERENCE_URL = previousUrl;
    }
    if (previousKey === undefined) {
      delete process.env.IMPEL_INFERENCE_API_KEY;
    } else {
      process.env.IMPEL_INFERENCE_API_KEY = previousKey;
    }
    if (previousOrg === undefined) {
      delete process.env.IMPEL_ORG_ID;
    } else {
      process.env.IMPEL_ORG_ID = previousOrg;
    }
    if (previousTransport === undefined) {
      delete process.env.IMPEL_CLAUDE_TRANSPORT;
    } else {
      process.env.IMPEL_CLAUDE_TRANSPORT = previousTransport;
    }
  }
});

test("createImpelClaudeModel can explicitly use durable workflow transport", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });

    if (String(url).endsWith("/v1/infer/start")) {
      const body = JSON.parse(String(init.body));
      assert.equal(body.provider, "claude-code");
      assert.equal(body.modelId, "claude-sonnet-4-5");
      assert.equal(body.orgId, "org_workflow");
      return new Response(
        JSON.stringify({
          runId: "run_claude_workflow",
          streamUrl:
            "/v1/infer/runs/run_claude_workflow/stream?startIndex=0&orgId=org_workflow",
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      );
    }

    if (
      String(url).endsWith(
        "/v1/infer/runs/run_claude_workflow/stream?startIndex=0&orgId=org_workflow",
      )
    ) {
      return new Response(
        sse([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "txt" },
          { type: "text-delta", id: "txt", delta: "workflow" },
          { type: "text-end", id: "txt" },
          finishPart(),
          "[DONE]",
        ]),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    }

    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const model = createImpelClaudeModel({
      baseUrl: "https://inference.test",
      apiKey: "secret",
      orgId: "org_workflow",
      modelId: "claude-sonnet-4-5",
      transport: "workflow",
    });
    const result = await model.doGenerate({ prompt: [] });

    assert.equal(result.content[0].type, "text");
    assert.equal(result.content[0].text, "workflow");
    assert.equal(requests.length, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("retries transient provider overload before surfacing API error text", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  const previousRetryDelay =
    process.env.IMPEL_INFERENCE_TRANSIENT_RETRY_DELAY_MS;
  process.env.IMPEL_INFERENCE_TRANSIENT_RETRY_DELAY_MS = "0";
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    const startCount = requests.filter((request) =>
      request.url.endsWith("/v1/infer/start"),
    ).length;

    if (String(url).endsWith("/v1/infer/start")) {
      return new Response(
        JSON.stringify({
          runId: `run_${startCount}`,
          streamUrl: `/v1/infer/runs/run_${startCount}/stream?startIndex=0&orgId=org_default`,
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      );
    }

    if (
      String(url).endsWith(
        "/v1/infer/runs/run_1/stream?startIndex=0&orgId=org_default",
      )
    ) {
      return new Response(
        sse([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "txt_error" },
          {
            type: "text-delta",
            id: "txt_error",
            delta: "API Error: 529 Overloaded.",
          },
          { type: "text-end", id: "txt_error" },
          { type: "error", error: { message: "529 Overloaded" } },
          "[DONE]",
        ]),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    }

    if (
      String(url).endsWith(
        "/v1/infer/runs/run_2/stream?startIndex=0&orgId=org_default",
      )
    ) {
      return new Response(
        sse([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "txt" },
          { type: "text-delta", id: "txt", delta: "ready" },
          { type: "text-end", id: "txt" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "completed" },
            usage: {
              inputTokens: {},
              outputTokens: {},
            },
            providerMetadata: {
              "claude-code": { terminalReason: "completed" },
            },
          },
          "[DONE]",
        ]),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    }

    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const model = impelInference("claude-opus-4-8", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_default",
      transport: "workflow",
    });

    const result = await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "ready?" }] }],
    });

    assert.equal(result.content[0].type, "text");
    assert.equal(result.content[0].text, "ready");
    assert.equal(
      requests.filter((request) => request.url.endsWith("/v1/infer/start"))
        .length,
      2,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousRetryDelay === undefined) {
      delete process.env.IMPEL_INFERENCE_TRANSIENT_RETRY_DELAY_MS;
    } else {
      process.env.IMPEL_INFERENCE_TRANSIENT_RETRY_DELAY_MS = previousRetryDelay;
    }
  }
});

test("surfaces structured provider errors with preceding provider text", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).endsWith("/v1/infer/start")) {
      return new Response(
        JSON.stringify({
          runId: "run_auth",
          streamUrl:
            "/v1/infer/runs/run_auth/stream?startIndex=0&orgId=org_auth",
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      );
    }

    if (
      String(url).endsWith(
        "/v1/infer/runs/run_auth/stream?startIndex=0&orgId=org_auth",
      )
    ) {
      return new Response(
        sse([
          { type: "stream-start", warnings: [] },
          { type: "response-metadata", id: "resp_auth" },
          { type: "text-start", id: "txt_auth" },
          {
            type: "text-delta",
            id: "txt_auth",
            delta:
              "Failed to authenticate. API Error: 401 Invalid authentication credentials",
          },
          { type: "error", error: { name: "AI_LoadAPIKeyError" } },
          "[DONE]",
        ]),
        {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "x-workflow-run-id": "run_auth",
          },
        },
      );
    }

    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const model = impelInference("claude-sonnet-4-5", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_auth",
      transport: "workflow",
    });

    await assert.rejects(
      () =>
        model.doGenerate({
          prompt: [{ role: "user", content: [{ type: "text", text: "report" }] }],
        }),
      (error) => {
        assert.ok(error instanceof Error);
        assert.notEqual(error.message, "[object Object]");
        assert.match(error.message, /AI_LoadAPIKeyError/);
        assert.match(error.message, /401 Invalid authentication credentials/);
        assert.deepEqual(error.cause, { name: "AI_LoadAPIKeyError" });
        return true;
      },
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("resumes detached stream with service cursor and org id", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  const previousResumeDelay = process.env.IMPEL_INFERENCE_RESUME_DELAY_MS;
  process.env.IMPEL_INFERENCE_RESUME_DELAY_MS = "0";

  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });

    if (String(url).endsWith("/v1/infer/start")) {
      return new Response(
        JSON.stringify({
          runId: "run_cursor",
          streamUrl:
            "/v1/infer/runs/run_cursor/stream?startIndex=0&orgId=org_default",
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      );
    }

    if (
      String(url).endsWith(
        "/v1/infer/runs/run_cursor/stream?startIndex=0&orgId=org_default",
      )
    ) {
      return new Response(sse([{ type: "stream-start", warnings: [] }]), {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "x-workflow-run-id": "run_cursor",
          "x-workflow-stream-tail-index": "4",
        },
      });
    }

    if (
      String(url).endsWith(
        "/v1/infer/runs/run_cursor/stream?startIndex=5&orgId=org_default",
      )
    ) {
      return new Response(
        sse([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "txt" },
          { type: "text-delta", id: "txt", delta: "resumed" },
          { type: "text-end", id: "txt" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "completed" },
            usage: {
              inputTokens: {},
              outputTokens: {},
            },
            providerMetadata: {
              "claude-code": { terminalReason: "completed" },
            },
          },
          "[DONE]",
        ]),
        {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "x-workflow-run-id": "run_cursor",
          },
        },
      );
    }

    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const model = impelInference("claude-opus-4-8", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_default",
      transport: "workflow",
    });

    const result = await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "ready?" }] }],
    });

    assert.equal(result.content[0].type, "text");
    assert.equal(result.content[0].text, "resumed");
    assert.ok(
      requests.some((request) =>
        request.url.endsWith(
          "/v1/infer/runs/run_cursor/stream?startIndex=5&orgId=org_default",
        ),
      ),
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousResumeDelay === undefined) {
      delete process.env.IMPEL_INFERENCE_RESUME_DELAY_MS;
    } else {
      process.env.IMPEL_INFERENCE_RESUME_DELAY_MS = previousResumeDelay;
    }
  }
});

test("recovers malformed stream frames by resuming the same inference run", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  const previousResumeDelay = process.env.IMPEL_INFERENCE_RESUME_DELAY_MS;
  process.env.IMPEL_INFERENCE_RESUME_DELAY_MS = "0";

  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });

    if (String(url).endsWith("/v1/infer/start")) {
      return new Response(
        JSON.stringify({
          runId: "run_parse",
          streamUrl:
            "/v1/infer/runs/run_parse/stream?startIndex=0&orgId=org_default",
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      );
    }

    if (
      String(url).endsWith(
        "/v1/infer/runs/run_parse/stream?startIndex=0&orgId=org_default",
      )
    ) {
      return new Response(
        rawSse(
          'data: {"type":"tool-input-delta","id":"tool","delta":"unterminated\n\n',
        ),
        {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "x-workflow-run-id": "run_parse",
            "x-workflow-stream-tail-index": "6",
          },
        },
      );
    }

    if (
      String(url).endsWith(
        "/v1/infer/runs/run_parse/stream?startIndex=7&orgId=org_default",
      )
    ) {
      return new Response(
        sse([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "txt" },
          { type: "text-delta", id: "txt", delta: "continued" },
          { type: "text-end", id: "txt" },
          finishPart(),
          "[DONE]",
        ]),
        {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "x-workflow-run-id": "run_parse",
          },
        },
      );
    }

    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const model = impelInference("claude-sonnet-4-5", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_default",
      transport: "workflow",
    });

    const result = await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "continue" }] }],
    });

    assert.equal(result.content[0].type, "text");
    assert.equal(result.content[0].text, "continued");
    assert.equal(
      requests.filter((request) => request.url.endsWith("/v1/infer/start"))
        .length,
      1,
    );
    assert.ok(
      requests.some((request) =>
        request.url.endsWith(
          "/v1/infer/runs/run_parse/stream?startIndex=7&orgId=org_default",
        ),
      ),
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousResumeDelay === undefined) {
      delete process.env.IMPEL_INFERENCE_RESUME_DELAY_MS;
    } else {
      process.env.IMPEL_INFERENCE_RESUME_DELAY_MS = previousResumeDelay;
    }
  }
});
