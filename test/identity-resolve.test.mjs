import test from "node:test";
import assert from "node:assert/strict";
import { readClientContextRunToken, createImpelEveChannelState } from "../dist/eve/channel.js";

test("readClientContextRunToken extracts only non-empty string tokens", () => {
  assert.equal(readClientContextRunToken({ runToken: "v1.abc.def" }), "v1.abc.def");
  assert.equal(readClientContextRunToken({ runToken: "" }), null);
  assert.equal(readClientContextRunToken({ runToken: 42 }), null);
  assert.equal(readClientContextRunToken({}), null);
  assert.equal(readClientContextRunToken(null), null);
});

test("channel state carries the run token outside the typed run context", () => {
  const state = createImpelEveChannelState(
    { orgId: "impel", repos: ["a/b"] },
    { runToken: "v1.x.y" },
  );
  assert.equal(state.workspaceAuth.runToken, "v1.x.y");
  assert.equal("runToken" in state.runContext, false);
  const defaulted = createImpelEveChannelState(null);
  assert.equal(defaulted.workspaceAuth.runToken, null);
});
