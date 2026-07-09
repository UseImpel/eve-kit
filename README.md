# @useimpel/eve-kit

Eve helpers and AI SDK providers for Impel gateway-backed agents.

The root package exports `impelInference`, an AI SDK `LanguageModelV3`
provider. Eve-specific glue lives under `/eve` subpaths so each agent can keep
the normal Eve filesystem layout: `agent.ts`, `channels/`, `sandbox/`,
`tools/`, `evals/`, and `subagents/`.

## Install

```sh
npm install https://github.com/UseImpel/eve-kit/archive/refs/tags/v0.2.51.tar.gz
```

## Eve Usage

```ts
// agent/agent.ts
import { defineAgent } from "eve";
import {
  createImpelClaudeModel,
  IMPEL_CLAUDE_CONTEXT_WINDOW_TOKENS,
} from "@useimpel/eve-kit/eve";

export default defineAgent({
  model: createImpelClaudeModel({
    defaultModelId: "claude-opus-4-8",
    effort: "xhigh",
    label: "system-agent",
  }),
  modelContextWindowTokens: IMPEL_CLAUDE_CONTEXT_WINDOW_TOKENS,
});
```

```ts
// agent/channels/eve.ts
import { defaultImpelEveChannel } from "@useimpel/eve-kit/eve/channel";

export default defaultImpelEveChannel();
```

```ts
// agent/sandbox/sandbox.ts
import { impelJustBashSandbox } from "@useimpel/eve-kit/eve/sandbox";

export default impelJustBashSandbox();
```

```ts
// agent/tools/render_ui.ts
export { renderUiTool as default } from "@useimpel/eve-kit/eve/render-ui";
```

```ts
// evals/evals.config.ts
import { createImpelBraintrustEvalConfig } from "@useimpel/eve-kit/eve/evals";

export default createImpelBraintrustEvalConfig({
  defaultAgentId: "agent-creator",
});
```

The helper selects `impel-gateway` when `IMPEL_GATEWAY_URL` or `gatewayUrl` is
configured. Without a gateway or inference URL, local `claudeCode(...)` fallback
is allowed only outside `NODE_ENV=production`, or when
`IMPEL_ALLOW_LOCAL_PROVIDER_FALLBACK=true` / `allowLocalProviderFallback: true`
is set for explicit local development.

Claude uses the gateway Anthropic-compatible endpoint at `/anthropic/v1` via
the standard Anthropic AI SDK provider, so Eve's normal AI SDK tools are
preserved through the gateway. Hosted
Eve calls should carry the signed `clientContext.runToken`; static
`IMPEL_GATEWAY_AUTH_TOKEN`, `IMPEL_GATEWAY_PAT`, or `gatewayAuthToken` auth is
accepted for local tooling and break-glass use.

## Root Provider

```ts
import { impelInference } from "@useimpel/eve-kit";

const model = impelInference("claude-opus-4-8", {
  providerOptions: {
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    effort: "xhigh",
  },
});
```

`impelInference()` calls hosted `/v1/model/stream`.

By default, `impelInference()` does not forward AI SDK reasoning stream parts to
the caller, which keeps the model stream stable across long provider-managed CLI
agent loops. Set `streamReasoning: true` only for callers that specifically need
reasoning parts and can tolerate AI SDK beta reasoning lifecycle strictness.
This is intended for provider-managed CLI loops where the AI SDK caller is not
responsible for replaying reasoning blocks back to the model.

## Codex Eve Helper

Use `createImpelCodexModel` when an Eve agent or declared subagent should run
Codex through `impel-gateway`, instead of constructing the generic provider by
hand:

```ts
import {
  createImpelCodexModel,
  IMPEL_CODEX_CONTEXT_WINDOW_TOKENS,
} from "@useimpel/eve-kit/eve";

export default defineAgent({
  model: createImpelCodexModel({
    modelId: process.env.IMPEL_CODEX_MODEL_ID,
    label: "implementation-coder",
    providerOptions: {
      reasoningEffort: "high",
    },
  }),
  modelContextWindowTokens: IMPEL_CODEX_CONTEXT_WINDOW_TOKENS,
});
```

The helper defaults to `IMPEL_CODEX_MODEL_ID` or `gpt-5.5` and configures Codex
app-server with `model_provider = "impel"` at
`/chatgpt_passthrough/backend-api/codex`. It applies the autonomous Codex
defaults `approvalMode: "never"`, `sandboxMode: "workspace-write"`, and
`skipGitRepoCheck: true`. Override those values only when the host runtime needs
a stricter mode.

The provider reads these environment variables by default:

- `IMPEL_GATEWAY_URL`
- `IMPEL_GATEWAY_AUTH_TOKEN`
- `IMPEL_GATEWAY_PAT`
- `IMPEL_INFERENCE_URL`
- `IMPEL_INFERENCE_API_KEY`
- `IMPEL_ALLOW_LOCAL_PROVIDER_FALLBACK`
- `IMPEL_ORG_ID`
- `IMPEL_RUN_REPOS`
- `IMPEL_RUN_BRANCH`
- `IMPEL_RUN_INSTALLATION_ID`
- `IMPEL_RUN_ID`
- `IMPEL_RUN_TRACE_ID`
- `IMPEL_RUN_AGENT`

You can override `gatewayUrl`, `gatewayAuthToken`, `baseUrl`, `apiKey`, `orgId`,
request `headers`, and `runContext` in code.

## Auth

This package does not contain credentials and does not grant access to
`impel-gateway`. Gateway requests require either a signed Eve
`clientContext.runToken`, `IMPEL_RUN_TOKEN`, `gatewayAuthToken`,
`IMPEL_GATEWAY_AUTH_TOKEN`, `IMPEL_GATEWAY_PAT`, or `IMPEL_PAT`. Legacy
`impel-inference` fallback still requires `apiKey` or
`IMPEL_INFERENCE_API_KEY`.

The default Eve HTTP channel enables `localDev()`, `vercelOidc()`, and Basic
auth from `EVE_APP_BASIC_USER`/`EVE_APP_BASIC_PASSWORD` or
`IMPEL_EVE_BASIC_USER`/`IMPEL_EVE_BASIC_PASSWORD`. Eve's `placeholderAuth()` is
not included by default because it rejects production browser requests; pass
`includePlaceholderAuth: true` only for explicit local scaffolding.

## Eve Client Context

Eve serializes `clientContext` into a prompt message shaped like:

```txt
Client context:
{"orgId":"...","repos":["UseImpel/next"],"branch":"main"}
```

This provider extracts that sentinel and uses `clientContext.runToken` as the
gateway bearer token, while scrubbing the literal token from text sent to the
model. The legacy inference fallback still forwards `orgId`, `repos`, `branch`,
`installationId`, `runId`, `traceId`, and `agent` to `/v1/model/stream`.

## OpenTelemetry Headers

Callers that need trace propagation can supply per-request headers:

```ts
import { context, propagation } from "@opentelemetry/api";
import { impelInference } from "@useimpel/eve-kit";

impelInference("claude-opus-4-8", {
  headers: () => {
    const headers: Record<string, string> = {};
    propagation.inject(context.active(), headers);
    return headers;
  },
});
```

The provider preserves its own `authorization`, `content-type`, `x-org-id`, and
`x-impel-org-id` headers so custom headers cannot override authentication or org
binding.
