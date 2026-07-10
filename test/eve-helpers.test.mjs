import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CONTEXT_WINDOW_TOKENS,
  resolveGatewayModelId,
  toGatewayModelId,
} from "../dist/eve/gateway.js";
import { resolveImpelModelId } from "../dist/eve/model.js";
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

test("normalizes gateway aliases to bare model ids", () => {
  assert.equal(DEFAULT_CONTEXT_WINDOW_TOKENS, 200000);
  assert.equal(toGatewayModelId("fable"), "claude-fable-5");
  assert.equal(toGatewayModelId("opus"), "claude-opus-4-8");
  assert.equal(toGatewayModelId("sonnet"), "claude-sonnet-4-6");
  assert.equal(toGatewayModelId("haiku"), "claude-haiku-4-5");
  assert.equal(toGatewayModelId("anthropic/claude-opus-4-8"), "claude-opus-4-8");
  assert.equal(toGatewayModelId("openai/gpt-5.5"), "gpt-5.5");
});

test("resolves model ids from env in priority order", () => {
  const primary = process.env.IMPEL_TEST_MODEL_PRIMARY;
  const fallback = process.env.IMPEL_TEST_MODEL_FALLBACK;
  try {
    delete process.env.IMPEL_TEST_MODEL_PRIMARY;
    process.env.IMPEL_TEST_MODEL_FALLBACK = "sonnet";
    assert.equal(
      resolveGatewayModelId(
        ["IMPEL_TEST_MODEL_PRIMARY", "IMPEL_TEST_MODEL_FALLBACK"],
        "claude-opus-4-8",
      ),
      "claude-sonnet-4-6",
    );
    process.env.IMPEL_TEST_MODEL_PRIMARY = "gpt-5.5";
    assert.equal(
      resolveImpelModelId(
        ["IMPEL_TEST_MODEL_PRIMARY", "IMPEL_TEST_MODEL_FALLBACK"],
        "claude-opus-4-8",
      ),
      "gpt-5.5",
    );
  } finally {
    restoreEnv("IMPEL_TEST_MODEL_PRIMARY", primary);
    restoreEnv("IMPEL_TEST_MODEL_FALLBACK", fallback);
  }
});

test("preserves the filtered Claude Bridge helper", async () => {
  const readOnly = impelClaudeBridgeConnection({
    url: "https://bridge.example/sse",
    token: "bridge-token",
  });
  assert.deepEqual(readOnly.tools, {
    allow: [...IMPEL_CLAUDE_BRIDGE_READ_ONLY_TOOLS],
  });
  assert.equal((await readOnly.auth?.getToken()).token, "bridge-token");
  assert.equal(
    readOnly.tools?.allow.includes(IMPEL_CLAUDE_BRIDGE_EXECUTE_TOOL),
    false,
  );

  const executable = impelClaudeBridgeConnection({
    url: "https://bridge.example/sse",
    includeExecuteTool: true,
  });
  assert.ok(executable.tools?.allow.includes(IMPEL_CLAUDE_BRIDGE_EXECUTE_TOOL));
});

test("normalizes and extracts Eve run context without consuming requests", async () => {
  const expected = {
    orgId: "impel",
    repos: ["UseImpel/next"],
    branch: "main",
    installationId: "12345",
  };
  assert.deepEqual(
    normalizeImpelEveRunContext({
      ...expected,
      repos: [" UseImpel/next ", "UseImpel/next", "", 42],
    }),
    expected,
  );

  const body = JSON.stringify({ message: "count commits", clientContext: expected });
  const request = new Request("https://agent.example/eve/v1/session", {
    method: "POST",
    body,
  });
  assert.deepEqual(await extractImpelEveRunContextFromRequest(request), expected);
  assert.equal(await request.text(), body);
});

test("preserves channel state and explicit trusted Vercel subjects", () => {
  const channel = defaultImpelEveChannel({
    basicUser: "user",
    basicPassword: "pass",
    prepareAttachedRepos: true,
    trustedVercelSubjects: [
      "owner:impel-bb80950e:project:next:environment:production",
    ],
  });
  assert.equal(channel.routes.length, 4);
  assert.ok(
    channel.routes.some(
      (route) => route.method === "GET" && route.path === "/eve/v1/info",
    ),
  );
  assert.equal(channel.adapter.kind, "defineChannel");
  assert.deepEqual(channel.adapter.state, createImpelEveChannelState(null));
});

test("default Eve info route applies the configured auth policy", async () => {
  const channel = defaultImpelEveChannel({
    basicUser: "user",
    basicPassword: "pass",
  });
  const route = channel.routes.find(
    (candidate) =>
      candidate.method === "GET" && candidate.path === "/eve/v1/info",
  );
  assert.ok(route);

  const response = await route.handler(
    new Request("https://agent.example/eve/v1/info"),
    {
      async send() {
        throw new Error("not used");
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

  assert.equal(response.status, 401);
});

test("default Eve session route seeds channel state from clientContext", async () => {
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
          runToken: "v2.gateway.payload",
          identityRunToken: "v1.identity.payload",
        },
      }),
    }),
    {
      async send(input, options) {
        sent.push({ input, options });
        return { continuationToken: "eve:session-token", id: "ses_123" };
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
  assert.deepEqual(sent[0].options.state.workspaceAuth, {
    identityRunToken: "v1.identity.payload",
  });
  assert.equal(sent[0].options.state.workspace.prepared, false);
  assert.match(sent[0].options.continuationToken, /^eve:/);
  assert.equal(
    sent[0].input.context[0],
    'Client context:\n{"orgId":"impel","repos":["UseImpel/next"],"branch":"main","runToken":"v2.gateway.payload","identityRunToken":"v1.identity.payload"}',
  );
  assert.match(sent[0].input.context[1], /UseImpel\/next: \/workspace/);
});

test("preserves deterministic repo checkout planning and workspace context", () => {
  assert.deepEqual(planImpelEveRepoCheckouts(["UseImpel/next"]), [
    { repo: "UseImpel/next", path: "/workspace", role: "primary" },
  ]);
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
  assert.match(
    createImpelWorkspaceContextMessage({
      repos: ["UseImpel/next", "UseImpel/eve-kit"],
    }),
    /UseImpel\/eve-kit: \/workspace\/eve-kit/,
  );
});

test("preserves Vercel Connect token parameter helpers", () => {
  assert.equal(
    resolveVercelConnectGitHubConnectorUid(undefined),
    "github/useimpel-github",
  );
  assert.deepEqual(createVercelConnectGitHubTokenParams({}), {
    subject: { type: "app" },
  });
  assert.deepEqual(
    createVercelConnectGitHubTokenParams({
      installationId: 12345,
      repos: ["UseImpel/next", "UseImpel/next", "UseImpel/eve-kit"],
    }),
    {
      subject: { type: "app" },
      installationId: "12345",
      authorizationDetails: [
        {
          type: "github_app_installation",
          repositories: ["next", "eve-kit"],
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

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
