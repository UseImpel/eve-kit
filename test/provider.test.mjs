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

test("streams from /start and forwards auth, trace headers, and Eve clientContext", async () => {
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

test("fails locally when no inference api key is configured", async () => {
  const model = impelInference("claude-opus-4-8", {
    baseUrl: "https://infer.example",
  });

  await assert.rejects(
    () => model.doStream({ prompt: [] }),
    /IMPEL_INFERENCE_API_KEY is required/,
  );
});

test("createImpelCodexModel routes Codex through impel-inference", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });

    if (String(url).endsWith("/v1/infer/start")) {
      const body = JSON.parse(String(init.body));
      assert.equal(body.provider, "codex-cli");
      assert.equal(body.modelId, "gpt-5.5");
      assert.equal(body.orgId, "org_codex");
      assert.equal(body.providerOptions.approvalMode, "never");
      assert.equal(body.providerOptions.sandboxMode, "workspace-write");
      assert.equal(body.providerOptions.skipGitRepoCheck, true);
      assert.equal(body.providerOptions.reasoningEffort, "high");
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
      providerOptions: { reasoningEffort: "high" },
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
