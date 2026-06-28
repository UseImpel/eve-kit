import assert from "node:assert/strict";
import test from "node:test";
import { impelInference } from "../dist/index.js";
import {
  createImpelClaudeModel,
  createImpelCodexModel,
  resolveImpelModelId,
} from "../dist/eve/model.js";
import {
  DEFAULT_CONTEXT_WINDOW_TOKENS,
  resolveGatewayModelId,
  toGatewayModelId,
} from "../dist/eve/gateway.js";
import {
  IMPEL_CLAUDE_BRIDGE_EXECUTE_TOOL,
  IMPEL_CLAUDE_BRIDGE_READ_ONLY_TOOLS,
  impelClaudeBridgeConnection,
} from "../dist/eve/connections/claude-bridge.js";
import {
  createImpelEveChannelState,
  createImpelWorkspaceContextMessage,
  createVercelConnectGitHubTokenParams,
  defaultImpelEveChannel,
  extractImpelEveRunContextFromRequest,
  normalizeImpelEveRunContext,
  planImpelEveRepoCheckouts,
  resolveVercelConnectGitHubConnectorUid,
} from "../dist/eve/channel.js";

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

test("normalizes legacy Impel model ids to AI Gateway ids", () => {
  assert.equal(DEFAULT_CONTEXT_WINDOW_TOKENS, 200000);
  assert.equal(toGatewayModelId("claude-opus-4-8"), "anthropic/claude-opus-4.8");
  assert.equal(toGatewayModelId("claude-sonnet-4-6"), "anthropic/claude-sonnet-4.6");
  assert.equal(toGatewayModelId("opus"), "anthropic/claude-opus-4.8");
  assert.equal(toGatewayModelId("sonnet"), "anthropic/claude-sonnet-4.6");
  assert.equal(toGatewayModelId("haiku"), "anthropic/claude-haiku-4.5");
  assert.equal(toGatewayModelId("gpt-5.5"), "openai/gpt-5.5");
  assert.equal(toGatewayModelId("anthropic/claude-opus-4.8"), "anthropic/claude-opus-4.8");
});

test("resolves AI Gateway model ids from env in priority order", () => {
  const previousPrimary = process.env.IMPEL_TEST_MODEL_PRIMARY;
  const previousFallback = process.env.IMPEL_TEST_MODEL_FALLBACK;

  try {
    delete process.env.IMPEL_TEST_MODEL_PRIMARY;
    process.env.IMPEL_TEST_MODEL_FALLBACK = "claude-sonnet-4-6";
    assert.equal(
      resolveGatewayModelId(
        ["IMPEL_TEST_MODEL_PRIMARY", "IMPEL_TEST_MODEL_FALLBACK"],
        "anthropic/claude-opus-4.8",
      ),
      "anthropic/claude-sonnet-4.6",
    );

    process.env.IMPEL_TEST_MODEL_PRIMARY = "openai/gpt-5.5";
    assert.equal(
      resolveGatewayModelId(
        ["IMPEL_TEST_MODEL_PRIMARY", "IMPEL_TEST_MODEL_FALLBACK"],
        "anthropic/claude-opus-4.8",
      ),
      "openai/gpt-5.5",
    );
  } finally {
    if (previousPrimary === undefined) delete process.env.IMPEL_TEST_MODEL_PRIMARY;
    else process.env.IMPEL_TEST_MODEL_PRIMARY = previousPrimary;
    if (previousFallback === undefined) delete process.env.IMPEL_TEST_MODEL_FALLBACK;
    else process.env.IMPEL_TEST_MODEL_FALLBACK = previousFallback;
  }
});

test("resolves raw impel-inference model ids from env without Gateway normalization", () => {
  const previousPrimary = process.env.IMPEL_TEST_MODEL_PRIMARY;
  const previousFallback = process.env.IMPEL_TEST_MODEL_FALLBACK;

  try {
    delete process.env.IMPEL_TEST_MODEL_PRIMARY;
    process.env.IMPEL_TEST_MODEL_FALLBACK = "claude-sonnet-4-6";
    assert.equal(
      resolveImpelModelId(
        ["IMPEL_TEST_MODEL_PRIMARY", "IMPEL_TEST_MODEL_FALLBACK"],
        "claude-opus-4-8",
      ),
      "claude-sonnet-4-6",
    );

    process.env.IMPEL_TEST_MODEL_PRIMARY = "anthropic/claude-opus-4.8";
    assert.equal(
      resolveImpelModelId(
        ["IMPEL_TEST_MODEL_PRIMARY", "IMPEL_TEST_MODEL_FALLBACK"],
        "claude-opus-4-8",
      ),
      "anthropic/claude-opus-4.8",
    );
  } finally {
    if (previousPrimary === undefined) delete process.env.IMPEL_TEST_MODEL_PRIMARY;
    else process.env.IMPEL_TEST_MODEL_PRIMARY = previousPrimary;
    if (previousFallback === undefined) delete process.env.IMPEL_TEST_MODEL_FALLBACK;
    else process.env.IMPEL_TEST_MODEL_FALLBACK = previousFallback;
  }
});

test("defines Claude Bridge as a filtered Eve MCP connection", async () => {
  const connection = impelClaudeBridgeConnection({
    url: "https://bridge.example/sse",
    token: "bridge-token",
  });

  assert.equal(connection.url, "https://bridge.example/sse");
  assert.deepEqual(connection.tools, {
    allow: [...IMPEL_CLAUDE_BRIDGE_READ_ONLY_TOOLS],
  });
  assert.equal(connection.auth?.principalType, "app");
  assert.equal((await connection.auth?.getToken()).token, "bridge-token");
});

test("keeps Claude Bridge execution opt-in", () => {
  const readOnlyConnection = impelClaudeBridgeConnection({
    url: "https://bridge.example/sse",
  });
  assert.equal(
    readOnlyConnection.tools?.allow.includes(IMPEL_CLAUDE_BRIDGE_EXECUTE_TOOL),
    false,
  );

  const executeConnection = impelClaudeBridgeConnection({
    url: "https://bridge.example/sse",
    includeExecuteTool: true,
  });
  assert.ok(
    executeConnection.tools?.allow.includes(IMPEL_CLAUDE_BRIDGE_EXECUTE_TOOL),
  );
});

test("normalizes Impel Eve run context from clientContext", () => {
  assert.deepEqual(
    normalizeImpelEveRunContext({
      orgId: "impel",
      repos: [" UseImpel/next ", "UseImpel/next", "", 42],
      branch: "main",
      installationId: "12345",
      runId: "run_123",
      traceId: "trace_123",
      agent: { agentId: "platform-engineer" },
      btParent: "00-parent",
    }),
    {
      orgId: "impel",
      repos: ["UseImpel/next"],
      branch: "main",
      installationId: "12345",
      runId: "run_123",
      traceId: "trace_123",
      agent: { agentId: "platform-engineer" },
      btParent: "00-parent",
    },
  );

  assert.equal(normalizeImpelEveRunContext(null), null);
});

test("extracts Impel Eve run context from Eve session requests without consuming the body", async () => {
  const request = new Request("https://agent.example/eve/v1/session", {
    method: "POST",
    body: JSON.stringify({
      message: "count commits",
      clientContext: {
        orgId: "impel",
        repos: ["UseImpel/next"],
        installationId: 12345,
      },
    }),
  });

  assert.deepEqual(await extractImpelEveRunContextFromRequest(request), {
    orgId: "impel",
    repos: ["UseImpel/next"],
    installationId: 12345,
  });

  assert.equal(await request.text(), JSON.stringify({
    message: "count commits",
    clientContext: {
      orgId: "impel",
      repos: ["UseImpel/next"],
      installationId: 12345,
    },
  }));
});

test("default Impel Eve channel is stateful for workspace preparation", () => {
  const channel = defaultImpelEveChannel({
    basicUser: "user",
    basicPassword: "pass",
    prepareAttachedRepos: true,
  });

  assert.equal(channel.routes.length, 3);
  assert.equal(channel.adapter.kind, "defineChannel");
  assert.deepEqual(channel.adapter.state, createImpelEveChannelState(null));
});

test("default Impel Eve channel accepts explicit trusted Vercel subjects", () => {
  const channel = defaultImpelEveChannel({
    trustedVercelSubjects: [
      "owner:impel-bb80950e:project:next:environment:production",
    ],
  });

  assert.equal(channel.routes.length, 3);
  assert.equal(channel.adapter.kind, "defineChannel");
});

test("Impel Eve repo checkout planning keeps single-repo runs at workspace root", () => {
  assert.deepEqual(planImpelEveRepoCheckouts(["UseImpel/next"]), [
    {
      repo: "UseImpel/next",
      path: "/workspace",
      role: "primary",
    },
  ]);
});

test("Impel Eve repo checkout planning gives every multi-repo run an explicit directory", () => {
  assert.deepEqual(
    planImpelEveRepoCheckouts([
      "UseImpel/impel-inference",
      "UseImpel/impel-ingestion",
    ]),
    [
      {
        repo: "UseImpel/impel-inference",
        path: "/workspace/impel-inference",
        role: "primary",
      },
      {
        repo: "UseImpel/impel-ingestion",
        path: "/workspace/impel-ingestion",
        role: "additional",
      },
    ],
  );
});

test("Impel Eve repo checkout planning disambiguates duplicate short names", () => {
  assert.deepEqual(
    planImpelEveRepoCheckouts(["UseImpel/web", "Acme/web"]),
    [
      {
        repo: "UseImpel/web",
        path: "/workspace/UseImpel__web",
        role: "primary",
      },
      {
        repo: "Acme/web",
        path: "/workspace/Acme__web",
        role: "additional",
      },
    ],
  );
});

test("Impel Eve workspace context tells the model the multi-repo checkout paths", () => {
  assert.equal(
    createImpelWorkspaceContextMessage({
      repos: [
        "UseImpel/next",
        "UseImpel/impel-inference",
        "UseImpel/impel-ingestion",
      ],
    }),
    [
      "Impel workspace context:",
      "- Layout: multi-repo-directory",
      "- The Eve sandbox command working directory is /workspace.",
      "- /workspace is a coordination directory, not a git checkout.",
      "- The attached repositories are already cloned at these paths:",
      "  - UseImpel/next: /workspace/next",
      "  - UseImpel/impel-inference: /workspace/impel-inference",
      "  - UseImpel/impel-ingestion: /workspace/impel-ingestion",
      "- Use git commands against the listed paths, for example: git -C <path> rev-list --count HEAD.",
      "- Do not ask the user for repo paths or GitHub tokens before checking these workspace paths.",
      "- Workspace metadata is also available at /workspace/.impel/run-context.json and /workspace/README_IMPEL_WORKSPACE.md.",
    ].join("\n"),
  );
});

test("default Impel Eve session route seeds channel state from clientContext", async () => {
  const channel = defaultImpelEveChannel({
    basicUser: "user",
    basicPassword: "pass",
    prepareAttachedRepos: true,
  });
  const route = channel.routes.find(
    (candidate) =>
      candidate.method === "POST" && candidate.path === "/eve/v1/session",
  );
  assert.ok(route);

  const sent = [];
  const response = await route.handler(
    new Request("https://agent.example/eve/v1/session", {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from("user:pass").toString("base64")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "count commits",
        clientContext: {
          orgId: "impel",
          repos: ["UseImpel/next"],
          branch: "main",
        },
      }),
    }),
    {
      async send(input, options) {
        sent.push({ input, options });
        return {
          continuationToken: "eve:session-token",
          id: "ses_123",
        };
      },
      getSession() {
        throw new Error("not used");
      },
      params: {},
      receive() {
        throw new Error("not used");
      },
      requestIp: null,
      waitUntil() {},
    },
  );

  assert.equal(response.status, 202);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].options.state.runContext, {
    orgId: "impel",
    repos: ["UseImpel/next"],
    branch: "main",
  });
  assert.equal(sent[0].options.state.workspace.prepared, false);
  assert.match(sent[0].options.continuationToken, /^eve:/);
  assert.deepEqual(sent[0].input.context, [
    'Client context:\n{"orgId":"impel","repos":["UseImpel/next"],"branch":"main"}',
    [
      "Impel workspace context:",
      "- Layout: single-repo-root",
      "- The Eve sandbox command working directory is /workspace.",
      "- The attached repository is already cloned at this path:",
      "  - UseImpel/next: /workspace",
      "- Use git commands against the listed paths, for example: git -C <path> rev-list --count HEAD.",
      "- Do not ask the user for repo paths or GitHub tokens before checking these workspace paths.",
      "- Workspace metadata is also available at /workspace/.impel/run-context.json and /workspace/README_IMPEL_WORKSPACE.md.",
    ].join("\n"),
  ]);
});

test("Vercel Connect GitHub token params support the connector default installation", () => {
  assert.equal(
    resolveVercelConnectGitHubConnectorUid(undefined),
    "github/useimpel-github",
  );
  assert.equal(
    resolveVercelConnectGitHubConnectorUid(""),
    "github/useimpel-github",
  );
  assert.equal(
    resolveVercelConnectGitHubConnectorUid(" github/custom "),
    "github/custom",
  );

  assert.deepEqual(createVercelConnectGitHubTokenParams({}), {
    subject: { type: "app" },
  });

  assert.deepEqual(
    createVercelConnectGitHubTokenParams({ installationId: 12345 }),
    {
      subject: { type: "app" },
      installationId: "12345",
    },
  );

  assert.deepEqual(
    createVercelConnectGitHubTokenParams({
      installationId: 12345,
      repos: ["UseImpel/next", "UseImpel/next", "UseImpel/impel-agents"],
    }),
    {
      subject: { type: "app" },
      installationId: "12345",
      authorizationDetails: [
        {
          type: "github_app_installation",
          repositories: ["next", "impel-agents"],
          permissions: [
            "contents:write",
            "pull_requests:write",
            "checks:read",
            "statuses:read",
          ],
        },
      ],
    },
  );
});

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

test("hosted stream forwards tools and toolChoice in callOptions", async () => {
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
      includeRawChunks: true,
    });
    await stream.cancel();

    assert.equal(requests.length, 1);
    const body = JSON.parse(String(requests[0].init.body));
    assert.deepEqual(body.callOptions.tools, [tool]);
    assert.deepEqual(body.callOptions.toolChoice, toolChoice);
    assert.equal(body.callOptions.temperature, 0.2);
    assert.equal(body.callOptions.includeRawChunks, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("hosted stream applies per-call headers and does not serialize runtime-only options", async () => {
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
    const signal = AbortSignal.timeout(1_000);
    const model = impelInference("claude-opus-4-8", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_tools",
    });

    const { stream } = await model.doStream({
      prompt: [],
      temperature: 0.4,
      abortSignal: signal,
      headers: {
        "x-call-header": "1",
        authorization: "ignored",
        "x-org-id": "ignored",
        "x-impel-org-id": "ignored",
      },
    });
    await stream.cancel();

    const body = JSON.parse(String(requests[0].init.body));
    assert.equal(body.callOptions.temperature, 0.4);
    assert.equal("abortSignal" in body.callOptions, false);
    assert.equal("headers" in body.callOptions, false);
    assert.equal(requests[0].init.signal, signal);
    assert.equal(requests[0].init.headers["x-call-header"], "1");
    assert.equal(requests[0].init.headers.authorization, "Bearer secret");
    assert.equal(requests[0].init.headers["x-org-id"], "org_tools");
    assert.equal(requests[0].init.headers["x-impel-org-id"], "org_tools");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("hosted stream keeps constructor and per-call providerOptions separate", async () => {
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
    const constructorProviderOptions = {
      permissionMode: "bypassPermissions",
      shared: "constructor",
    };
    const callProviderOptions = {
      "claude-code": { maxTurns: 2 },
      shared: "call",
    };
    const model = impelInference("claude-opus-4-8", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_tools",
      providerOptions: constructorProviderOptions,
    });

    const { stream } = await model.doStream({
      prompt: [],
      providerOptions: callProviderOptions,
    });
    await stream.cancel();

    const body = JSON.parse(String(requests[0].init.body));
    assert.deepEqual(body.providerOptions, constructorProviderOptions);
    assert.deepEqual(body.callOptions.providerOptions, callProviderOptions);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("hosted stream rejects non-JSON call options before fetch", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    assert.fail("fetch should not be called for non-JSON request bodies");
  };

  try {
    const model = impelInference("claude-opus-4-8", {
      baseUrl: "https://infer.example",
      apiKey: "secret",
      orgId: "org_tools",
    });

    await assert.rejects(
      () =>
        model.doStream({
          prompt: [],
          providerOptions: { bad: () => undefined },
        }),
      /request body\.callOptions\.providerOptions\.bad contains non-JSON value: function/,
    );
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
          type: "tool-approval-request",
          approvalId: "approval_1",
          toolCallId: "call_1",
        },
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
        type: "tool-approval-request",
        approvalId: "approval_1",
        toolCallId: "call_1",
      },
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

test("hosted stream forwards auth, trace headers, and Eve clientContext", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });

    if (String(url).endsWith("/v1/model/stream")) {
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
          headers: { "content-type": "text/event-stream" },
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
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("filters reasoning stream parts by default", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/v1/model/stream")) {
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
    if (String(url).endsWith("/v1/model/stream")) {
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
          headers: { "content-type": "text/event-stream" },
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

test("createImpelClaudeModel uses hosted model stream", async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.IMPEL_INFERENCE_URL;
  const previousKey = process.env.IMPEL_INFERENCE_API_KEY;
  const previousOrg = process.env.IMPEL_ORG_ID;

  process.env.IMPEL_INFERENCE_URL = "https://inference.test";
  process.env.IMPEL_INFERENCE_API_KEY = "secret";
  process.env.IMPEL_ORG_ID = "org_env";
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
    const streamCount = requests.filter((request) =>
      request.url.endsWith("/v1/model/stream"),
    ).length;

    if (String(url).endsWith("/v1/model/stream") && streamCount === 1) {
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

    if (String(url).endsWith("/v1/model/stream") && streamCount === 2) {
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
      requests.filter((request) => request.url.endsWith("/v1/model/stream"))
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
    if (String(url).endsWith("/v1/model/stream")) {
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
          headers: { "content-type": "text/event-stream" },
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
