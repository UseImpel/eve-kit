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

async function captureModelStreamRequest(prompt) {
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
      orgId: "org_files",
    });

    const { stream } = await model.doStream({ prompt });
    await stream.cancel();

    assert.equal(requests.length, 1);
    return {
      body: JSON.parse(String(requests[0].init.body)),
      rawBody: String(requests[0].init.body),
    };
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function filePrompt(data) {
  return [
    {
      role: "user",
      content: [
        { type: "text", text: "what is in this image?" },
        { type: "file", mediaType: "image/png", filename: "shot.png", data },
      ],
    },
  ];
}

test("rewrites Uint8Array file data to a tagged base64 string", async () => {
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const { body, rawBody } = await captureModelStreamRequest(filePrompt(bytes));

  const filePart = body.prompt[0].content[1];
  assert.deepEqual(filePart, {
    type: "file",
    mediaType: "image/png",
    filename: "shot.png",
    data: { type: "data", data: Buffer.from(bytes).toString("base64") },
  });
  assert.doesNotMatch(rawBody, /"0":\s*137/);
});

test("rewrites Buffer file data to a tagged base64 string", async () => {
  const bytes = Buffer.from([137, 80, 78, 71]);
  const { body, rawBody } = await captureModelStreamRequest(filePrompt(bytes));

  assert.deepEqual(body.prompt[0].content[1].data, {
    type: "data",
    data: bytes.toString("base64"),
  });
  assert.doesNotMatch(rawBody, /"type":"Buffer"/);
});

test("tags base64-string file data as inline data", async () => {
  const { body } = await captureModelStreamRequest(filePrompt("aGVsbG8="));

  assert.deepEqual(body.prompt[0].content[1].data, {
    type: "data",
    data: "aGVsbG8=",
  });
});

test("tags https-string and URL-instance file data as url", async () => {
  const httpsString = await captureModelStreamRequest(
    filePrompt("https://blob.example/cat.png"),
  );
  assert.deepEqual(httpsString.body.prompt[0].content[1].data, {
    type: "url",
    url: "https://blob.example/cat.png",
  });

  const urlInstance = await captureModelStreamRequest(
    filePrompt(new URL("https://blob.example/dog.png")),
  );
  assert.deepEqual(urlInstance.body.prompt[0].content[1].data, {
    type: "url",
    url: "https://blob.example/dog.png",
  });
});

test("parses data-URL file data into a tagged base64 payload", async () => {
  const asString = await captureModelStreamRequest(
    filePrompt("data:image/png;base64,aGVsbG8="),
  );
  assert.deepEqual(asString.body.prompt[0].content[1].data, {
    type: "data",
    data: "aGVsbG8=",
  });

  const asUrl = await captureModelStreamRequest(
    filePrompt(new URL("data:image/png;base64,aGVsbG8=")),
  );
  assert.deepEqual(asUrl.body.prompt[0].content[1].data, {
    type: "data",
    data: "aGVsbG8=",
  });
});

test("passes already-tagged and unrecognized file data through unchanged", async () => {
  const tagged = await captureModelStreamRequest(
    filePrompt({ type: "data", data: "aGVsbG8=" }),
  );
  assert.deepEqual(tagged.body.prompt[0].content[1].data, {
    type: "data",
    data: "aGVsbG8=",
  });

  const taggedBinary = await captureModelStreamRequest(
    filePrompt({ type: "data", data: new Uint8Array([1, 2, 3]) }),
  );
  assert.deepEqual(taggedBinary.body.prompt[0].content[1].data, {
    type: "data",
    data: Buffer.from([1, 2, 3]).toString("base64"),
  });

  const reference = await captureModelStreamRequest(
    filePrompt({ type: "reference", reference: { anthropic: "file-xyz" } }),
  );
  assert.deepEqual(reference.body.prompt[0].content[1].data, {
    type: "reference",
    reference: { anthropic: "file-xyz" },
  });
});

test("leaves a text-only prompt byte-identical", async () => {
  const prompt = [
    { role: "system", content: "be brief" },
    { role: "user", content: [{ type: "text", text: "hello" }] },
  ];

  const { body } = await captureModelStreamRequest(prompt);

  assert.equal(JSON.stringify(body.prompt), JSON.stringify(prompt));
});
