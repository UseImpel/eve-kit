import test from "node:test";
import assert from "node:assert/strict";
import {
  ImpelIdentityResolveError,
  createImpelEveChannelState,
  prepareImpelEveWorkspace,
  readClientContextIdentityRunToken,
  readClientContextRunToken,
} from "../dist/eve/channel.js";

test("gateway and identity assertions are read from separate clientContext fields", () => {
  const context = {
    runToken: "v2.gateway.payload",
    identityRunToken: "v1.identity.payload",
  };
  assert.equal(readClientContextRunToken(context), "v2.gateway.payload");
  assert.equal(
    readClientContextIdentityRunToken(context),
    "v1.identity.payload",
  );
  assert.equal(readClientContextRunToken({ runToken: "" }), null);
  assert.equal(readClientContextRunToken({ runToken: 42 }), null);
  assert.equal(readClientContextRunToken({}), null);
  assert.equal(readClientContextRunToken(null), null);
});

test("identity assertion compatibility accepts only a legacy v1 runToken", () => {
  assert.equal(
    readClientContextIdentityRunToken({ runToken: "v1.legacy.payload" }),
    "v1.legacy.payload",
  );
  assert.equal(
    readClientContextIdentityRunToken({ runToken: "v2.gateway.payload" }),
    null,
  );
  assert.equal(
    readClientContextIdentityRunToken({
      runToken: "v1.legacy.payload",
      identityRunToken: "",
    }),
    null,
  );
});

test("channel state writes identityRunToken and normalizes serialized v1 state", () => {
  const state = createImpelEveChannelState(
    { orgId: "impel", repos: ["a/b"] },
    { identityRunToken: "v1.identity.payload" },
  );
  assert.deepEqual(state.workspaceAuth, {
    identityRunToken: "v1.identity.payload",
  });
  assert.equal("runToken" in state.runContext, false);

  const legacy = createImpelEveChannelState(null, {
    runToken: "v1.legacy.payload",
  });
  assert.deepEqual(legacy.workspaceAuth, {
    identityRunToken: "v1.legacy.payload",
  });
  const legacyV2 = createImpelEveChannelState(null, {
    runToken: "v2.gateway.payload",
  });
  assert.deepEqual(legacyV2.workspaceAuth, { identityRunToken: null });
});

test("identity HTTP failure is typed, uses only v1, and never falls back to static credentials", async () => {
  const env = snapshotEnv([
    "IMPEL_IDENTITY_URL",
    "IMPEL_EVE_GITHUB_TOKEN",
    "GITHUB_TOKEN",
    "GH_TOKEN",
  ]);
  const originalFetch = globalThis.fetch;
  const requests = [];
  let networkPolicyCalls = 0;
  try {
    process.env.IMPEL_IDENTITY_URL = "https://identity.example";
    process.env.IMPEL_EVE_GITHUB_TOKEN = "must-not-fallback";
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    globalThis.fetch = async (input, init = {}) => {
      requests.push({
        url: String(input),
        headers: new Headers(init.headers),
      });
      return Response.json({ error: "unauthorized" }, { status: 401 });
    };

    const state = createImpelEveChannelState(
      { orgId: "impel", repos: ["UseImpel/next"] },
      { identityRunToken: "v1.identity.payload" },
    );
    const sandbox = {
      id: "sandbox_1",
      async run() {
        return { exitCode: 0, stderr: "", stdout: "" };
      },
      async setNetworkPolicy() {
        networkPolicyCalls += 1;
      },
      async writeTextFile() {},
    };

    await assert.rejects(
      () =>
        prepareImpelEveWorkspace(state, {
          getSandbox: async () => sandbox,
        }),
      (error) => {
        assert.ok(error instanceof ImpelIdentityResolveError);
        assert.equal(error.code, "http_error");
        assert.equal(error.status, 401);
        assert.doesNotMatch(error.message, /identity\.payload|must-not-fallback/);
        return true;
      },
    );

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://identity.example/v1/resolve");
    assert.equal(
      requests[0].headers.get("x-impel-run-token"),
      "v1.identity.payload",
    );
    assert.equal(networkPolicyCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    env.restore();
  }
});

test("empty identity responses fail closed for serialized legacy v1 state", async () => {
  const env = snapshotEnv([
    "IMPEL_IDENTITY_URL",
    "IMPEL_EVE_GITHUB_TOKEN",
    "GITHUB_TOKEN",
    "GH_TOKEN",
  ]);
  const originalFetch = globalThis.fetch;
  let networkPolicyCalls = 0;
  let identityHeader = null;
  try {
    process.env.IMPEL_IDENTITY_URL = "https://identity.example";
    process.env.IMPEL_EVE_GITHUB_TOKEN = "must-not-fallback";
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    globalThis.fetch = async (_input, init = {}) => {
      identityHeader = new Headers(init.headers).get("x-impel-run-token");
      return Response.json({});
    };

    const state = createImpelEveChannelState(
      { orgId: "impel", repos: ["UseImpel/next"] },
    );
    // Shape used by in-flight sessions serialized before identityRunToken was
    // introduced. It must be read but never emitted by new state creation.
    state.workspaceAuth = { runToken: "v1.legacy.payload" };
    const sandbox = {
      id: "sandbox_legacy",
      async run() {
        return { exitCode: 0, stderr: "", stdout: "" };
      },
      async setNetworkPolicy() {
        networkPolicyCalls += 1;
      },
      async writeTextFile() {},
    };

    await assert.rejects(
      () =>
        prepareImpelEveWorkspace(state, {
          getSandbox: async () => sandbox,
        }),
      (error) => {
        assert.ok(error instanceof ImpelIdentityResolveError);
        assert.equal(error.code, "invalid_response");
        assert.doesNotMatch(error.message, /legacy\.payload|must-not-fallback/);
        return true;
      },
    );
    assert.equal(identityHeader, "v1.legacy.payload");
    assert.equal(networkPolicyCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    env.restore();
  }
});

test("an explicit v2 identity assertion fails closed without reaching identity", async () => {
  const env = snapshotEnv(["IMPEL_IDENTITY_URL", "IMPEL_EVE_GITHUB_TOKEN"]);
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  try {
    process.env.IMPEL_IDENTITY_URL = "https://identity.example";
    process.env.IMPEL_EVE_GITHUB_TOKEN = "must-not-fallback";
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return Response.json({ token: "unexpected" });
    };
    const state = createImpelEveChannelState(
      { orgId: "impel", repos: ["UseImpel/next"] },
      { identityRunToken: "v2.gateway.payload" },
    );
    const sandbox = {
      id: "sandbox_2",
      async run() {
        return { exitCode: 0, stderr: "", stdout: "" };
      },
      async setNetworkPolicy() {
        throw new Error("must not use a fallback credential");
      },
      async writeTextFile() {},
    };

    await assert.rejects(
      () =>
        prepareImpelEveWorkspace(state, {
          getSandbox: async () => sandbox,
        }),
      (error) => {
        assert.ok(error instanceof ImpelIdentityResolveError);
        assert.equal(error.code, "invalid_assertion");
        return true;
      },
    );
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    env.restore();
  }
});

function snapshotEnv(names) {
  const values = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  return {
    restore() {
      for (const [name, value] of Object.entries(values)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    },
  };
}
