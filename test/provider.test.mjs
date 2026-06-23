import assert from "node:assert/strict";
import test from "node:test";
import { impelInference } from "../dist/index.js";

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
          streamUrl: "/v1/infer/runs/run_1/stream?startIndex=0",
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      );
    }

    if (String(url).endsWith("/v1/infer/runs/run_1/stream?startIndex=0")) {
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
