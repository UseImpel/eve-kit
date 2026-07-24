# @useimpel/eve-kit

Eve helpers and AI SDK providers for Impel gateway-backed agents.

Version 1 makes `impelGatewayModel` the default model path. It is a conventional
AI SDK `LanguageModelV4`: Eve owns the tool loop, sandbox, structured output,
transcript, approvals, and subagents. The gateway selects a pooled provider
account and performs one Anthropic Messages or OpenAI Responses model turn.

## Install

```sh
npm install https://github.com/UseImpel/eve-kit/archive/refs/tags/v1.4.0.tar.gz
```

## Eve usage

```ts
// agent/agent.ts
import { defineAgent } from "eve";
import {
  createImpelClaudeModel,
  IMPEL_CLAUDE_CONTEXT_WINDOW_TOKENS,
} from "@useimpel/eve-kit/eve";

export default defineAgent({
  model: createImpelClaudeModel({ modelId: "sonnet" }),
  modelContextWindowTokens: IMPEL_CLAUDE_CONTEXT_WINDOW_TOKENS,
});
```

`createImpelClaudeModel` is a compatibility shim over the root factory. New
code can use the root export directly:

```ts
import { impelGatewayModel } from "@useimpel/eve-kit";

const claude = impelGatewayModel("claude-opus-4-8");
const codex = impelGatewayModel("gpt-5.5");
```

Claude IDs route through `${IMPEL_GATEWAY_URL}/anthropic/v1/messages` with
`@ai-sdk/anthropic`. GPT, o-series, and Codex IDs route through
`${IMPEL_GATEWAY_URL}/v1/responses` with `@ai-sdk/openai`; Responses requests
always set `store: false` so encrypted reasoning can be replayed by Eve.

The aliases are:

- `fable` → `claude-fable-5`
- `opus` → `claude-opus-4-8`
- `sonnet` → `claude-sonnet-4-6`
- `haiku` → `claude-haiku-4-5`

Bare IDs are sent to the gateway. Legacy `anthropic/` and `openai/` prefixes are
accepted and stripped.

## Authentication

Hosted requests use one bearer credential. A trusted packed
`clientContext.runToken` is authoritative. Only when the prompt has no trusted
packed current context does resolution continue through:

1. `runContext.runToken` configured on the model
2. `IMPEL_RUN_TOKEN`
3. explicit `authToken`
4. `IMPEL_GATEWAY_TOKEN`
5. `IMPEL_PAT`

Packed capability values are replaced with `<impel-run-token>` before prompt
text reaches the provider. For Eve 0.22.1, only standalone exact packed
messages in the consecutive user-role context block immediately before the
final/current user message are trusted for authentication. The current user
message itself and all system, assistant, and tool text are never parsed for
credentials. Exact packed historical blocks are scanned separately only to
redact every historical token.
Sentinel-shaped objects quoted or forged anywhere else in prompt text likewise
never authenticate, but every `runToken` or `identityRunToken` they contain is
redacted before the request is sent upstream.

If the authoritative current packed context is tokenless, the call fails closed
instead of downgrading to configured, environment, or PAT credentials.
Configured and per-call `Authorization` or `x-api-key` headers are removed
case-insensitively; tracing and attribution headers are preserved.

```ts
const model = impelGatewayModel("sonnet", {
  gatewayUrl: "https://gateway.useimpel.com",
  runContext: () => ({ runToken: currentRunToken }),
  headers: () => ({ traceparent: currentTraceparent }),
});
```

The Anthropic provider uses its `authToken` setting, which emits only
`Authorization: Bearer …`; no API-key header or simulated CLI user agent is
added by eve-kit. Gateway model instances also retain the AI SDK's Workflow
serialization hooks and deserialize back into the gateway wrapper.

Attached-repository workspace prep uses a separate server-only v1
`clientContext.identityRunToken` when `IMPEL_IDENTITY_URL` is configured. The
gateway-audience v2 `clientContext.runToken` is never sent to impel-identity.
For older dispatchers, a v1 `runToken` may serve as the identity assertion only
when `identityRunToken` is absent. Once a centralized identity assertion is
present, identity HTTP, network, or empty-response failures fail closed instead
of falling through to static, Vercel Connect, or GitHub App credentials. Keep
both tokens on the Next → Eve → gateway/identity server path; never expose them
to browser clients.

Release workflows use `signReleaseGatewayRunToken()` with a dedicated
`urn:useimpel:release-ci:<registry>` issuer and repository secret. This API
requires an exact canonical agent ID, forbids user claims, and does not broaden
`signGatewayRunToken()`, which remains pinned to `urn:useimpel:next`. The
gateway and identity keyrings remain authoritative for each issuer's exact org
and agent allowlist.

## Pool errors

`model_not_entitled`, `pool_exhausted`, and `pool_rate_limited` responses are
surfaced as `ImpelGatewayPoolError`. It exposes `code`, `retryable`,
`isRetryable`, `retryAfter` (milliseconds), `model`, and `org`.
`model_not_entitled` is non-retryable even though the gateway wire response is a
502; the surfaced error intentionally hides that status so Eve does not retry a
capacity configuration problem.

## Codex compatibility helpers

```ts
import {
  createImpelCodexModel,
  createImpelOpenAIResponsesModel,
} from "@useimpel/eve-kit/eve";
```

Both helpers now return the same pure-Eve OpenAI Responses model. Historical
approval, sandbox, working-directory, and local-provider options remain typed as
deprecated no-ops; those policies belong to Eve.

## Opt-in CLI runner

`@useimpel/eve-kit/eve/cli-runner` is a separate, fail-closed v1 subpath. It is
not re-exported from the root or `./eve` barrels and does not load a heavy CLI
SDK. The stub throws until a runner can explicitly bridge Eve tools, sandbox
policy, hooks, and structured output. There is no implicit CLI fallback.

## Acceptance pilots

With `IMPEL_GATEWAY_URL` and `IMPEL_GATEWAY_TOKEN` set, run the transport-level
AI SDK probe with `npm run pilot:gateway`. Run `npm run pilot:gateway:eve` for
the framework-level acceptance check: it boots a real Eve app, executes the
side-effect-free `echo_probe` tool, requires structured `final_output`, and
asserts the emitted `result.completed` event. Override its default model with
`IMPEL_PILOT_MODEL_ID` when validating a particular pool.

Both pilots fail closed when gateway configuration is absent and never print
the bearer token. Their scripts and Eve fixture are included in the release
tarball, and they use its prebuilt `dist/` output rather than requiring the
package's development-only TypeScript toolchain.

## Other Eve helpers

Orthogonal helpers remain on their existing subpaths:

```ts
import { defaultImpelEveChannel } from "@useimpel/eve-kit/eve/channel";
import { impelJustBashSandbox } from "@useimpel/eve-kit/eve/sandbox";
import { renderUiTool } from "@useimpel/eve-kit/eve/render-ui";
import { createImpelBraintrustEvalConfig } from "@useimpel/eve-kit/eve/evals";
```

Code-intelligence tools are opt-in files in each agent bundle. The tool name
comes from the agent file name:

```ts
// agent/tools/code_search.ts
export { codeSearchTool as default } from "@useimpel/eve-kit/eve/code-intelligence-tools";
```

The module also exports `codeWorkspaceStatusTool`, `codeReadTool`,
`codeContextTool`, `codeImpactTool`, `codeTraceTool`, and
`codeDiffImpactTool`. `defaultImpelEveChannel()` moves the control plane's
server-only `x-impel-identity-run-token` header into authenticated session
attributes. The tools forward that signed assertion directly to
`IMPEL_CODE_INTELLIGENCE_URL` (defaulting to
`https://code-intelligence.useimpel.ai`). The service derives org, run, and
agent identity from the signature and lazily snapshots that tenant's immutable
exact-commit catalog. The model supplies only a repository label and query
inputs; it never supplies tenant identity, workspace identity, or credentials.

`defaultImpelEveChannel()` preserves Eve's authenticated
`GET /eve/v1/info` inspection route alongside Impel's stateful session routes,
so standard clients, evals, and deployment probes can discover agent
capabilities without a parallel transport.

Large attached repositories can opt into a per-repository partial sparse
checkout. Paths use Git's cone-mode directory semantics (not globs), are matched
to repository names case-insensitively, and leave every unconfigured repository
on the existing full-checkout path:

```ts
export default defaultImpelEveChannel({
  attachedRepoSparsePaths: {
    "CreadorFund/impel-wiki": ["wiki"],
  },
});
```

This uses `git fetch --filter=blob:none` and materializes `wiki/**` plus the
root/parent files included by cone mode; sibling trees such as `raw/**` remain
outside the worktree. Values must be repository-relative directory paths.
Absolute paths, `.`/`..`, backslashes, globs, and shell metacharacters are
rejected when the channel is constructed.

See [MIGRATION.md](./MIGRATION.md) for the v1 cutover checklist.
