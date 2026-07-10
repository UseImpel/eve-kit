import assert from "node:assert/strict";
import test from "node:test";

import { smokeDeployedRuntime } from "../dist/eve/runtime.js";

function runtimeFetch(events, onCancel) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }
    },
    cancel: onCancel,
  });

  return async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/health")) return new Response(null);
    if (url.pathname === "/eve/v1/session" && init?.method === "POST") {
      return Response.json({ sessionId: "session-1" });
    }
    if (url.pathname.endsWith("/stream")) {
      return new Response(stream, {
        headers: { "content-type": "application/x-ndjson" },
      });
    }
    return new Response("not found", { status: 404 });
  };
}

test("deployed smoke returns at a completed conversational turn boundary", async () => {
  let streamCancelled = false;
  const result = await smokeDeployedRuntime({
    baseUrl: "https://agent.example",
    timeoutMs: 1_000,
    fetch: runtimeFetch(
      [
        { type: "message.completed", data: { messageSoFar: "ready" } },
        { type: "step.completed" },
        { type: "turn.completed" },
        { type: "session.waiting" },
      ],
      () => {
        streamCancelled = true;
      },
    ),
  });

  assert.equal(result.completed, true);
  assert.equal(result.eventCount, 4);
  assert.equal(result.textBytes, 5);
  assert.equal(streamCancelled, true);
});

test("step completion at a waiting boundary is not a completed turn", async () => {
  const result = await smokeDeployedRuntime({
    baseUrl: "https://agent.example",
    timeoutMs: 1_000,
    fetch: runtimeFetch(
      [
        { type: "message.completed", data: { messageSoFar: "approve?" } },
        { type: "step.completed" },
        { type: "session.waiting" },
      ],
      () => {},
    ),
  });

  assert.equal(result.completed, false);
  assert.equal(result.eventCount, 3);
});

test("completed read_file output with truncated false passes", async () => {
  const result = await smokeDeployedRuntime({
    baseUrl: "https://agent.example",
    timeoutMs: 1_000,
    fetch: runtimeFetch(
      [
        {
          type: "action.result",
          data: {
            result: {
              callId: "read-file-1",
              kind: "tool-result",
              output: {
                content: "DEPLOYMENT_SMOKE_OK",
                path: "/workspace/DEPLOYMENT_SMOKE.txt",
                totalLines: 1,
                truncated: false,
              },
              toolName: "read_file",
            },
            sequence: 1,
            status: "completed",
            stepIndex: 0,
            turnId: "turn-1",
          },
        },
        { type: "turn.completed" },
        { type: "session.waiting" },
      ],
      () => {},
    ),
  });

  assert.equal(result.completed, true);
  assert.equal(result.eventCount, 3);
});

test("ordinary assistant text mentioning truncation passes", async () => {
  const result = await smokeDeployedRuntime({
    baseUrl: "https://agent.example",
    timeoutMs: 1_000,
    fetch: runtimeFetch(
      [
        {
          type: "message.completed",
          data: {
            finishReason: "stop",
            messageSoFar: "The file was not truncated.",
          },
        },
        { type: "turn.completed" },
        { type: "session.waiting" },
      ],
      () => {},
    ),
  });

  assert.equal(result.completed, true);
  assert.equal(result.textBytes, 27);
});

test("true truncated metadata fails", async () => {
  await assert.rejects(
    smokeDeployedRuntime({
      baseUrl: "https://agent.example",
      timeoutMs: 1_000,
      fetch: runtimeFetch(
        [
          {
            type: "action.result",
            data: { result: { output: { truncated: true } } },
          },
        ],
        () => {},
      ),
    }),
    /stream contained truncation marker/,
  );
});

test("length finish reason fails", async () => {
  await assert.rejects(
    smokeDeployedRuntime({
      baseUrl: "https://agent.example",
      timeoutMs: 1_000,
      fetch: runtimeFetch(
        [{ type: "message.completed", data: { finishReason: "length" } }],
        () => {},
      ),
    }),
    /non-success finishReason=length/,
  );
});
