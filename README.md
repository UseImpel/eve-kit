# @useimpel/eve-kit

Eve helpers and AI SDK provider for Impel's durable inference service.

The root package exports `impelInference`, an AI SDK `LanguageModelV3`
provider. Eve-specific glue lives under `/eve` subpaths so each agent can keep
the normal Eve filesystem layout: `agent.ts`, `channels/`, `sandbox/`,
`tools/`, `evals/`, and `subagents/`.

## Install

```sh
npm install https://github.com/UseImpel/eve-kit/archive/refs/tags/v0.2.11.tar.gz
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

The helper selects `impel-inference` when `IMPEL_INFERENCE_URL` or `baseUrl` is
configured. Without an inference URL, local `claudeCode(...)` fallback is allowed
only outside `NODE_ENV=production`, or when
`IMPEL_ALLOW_LOCAL_PROVIDER_FALLBACK=true` / `allowLocalProviderFallback: true`
is set for explicit local development.

Claude uses the durable `/v1/infer` workflow transport by default. Set
`IMPEL_CLAUDE_TRANSPORT=model-stream` or pass `transport: "model-stream"` to opt
into the hosted Claude Code gateway path, where `impel-inference` runs
`claudeCode()` in-process and owns Claude access-token resolution/refresh
centrally instead of seeding a sandbox credential file.

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

By default, `impelInference()` does not forward AI SDK reasoning stream parts to
the caller. The full raw reasoning stream is still recorded in
`impel-inference` provider traces, while the model stream remains stable across
long provider-managed CLI agent loops. Set `streamReasoning: true` only for
callers that specifically need reasoning parts and can tolerate AI SDK beta
reasoning lifecycle strictness.
This is intended for provider-managed CLI loops where the AI SDK caller is not
responsible for replaying reasoning blocks back to the model.

## Codex Eve Helper

Use `createImpelCodexModel` when an Eve agent or declared subagent should run
Codex through `impel-inference` directly, instead of constructing the generic
provider by hand:

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

The helper defaults to `IMPEL_CODEX_MODEL_ID` or `gpt-5.5` and uses the hosted
`/v1/model/stream` transport by default. That path lets `impel-inference` own
ChatGPT token bootstrap and refresh through Codex app-server, instead of seeding
refresh-capable credentials into a sandbox. It sends `provider:
"codex-app-server"` and applies the autonomous Codex defaults `approvalMode:
"never"`, `sandboxMode: "workspace-write"`, and `skipGitRepoCheck: true`.
Override those values only when the host runtime needs a stricter mode.

Set `transport: "workflow"` to use the older durable `/v1/infer` sandbox path:

```ts
createImpelCodexModel({
  transport: "workflow",
});
```

The provider reads these environment variables by default:

- `IMPEL_INFERENCE_URL`
- `IMPEL_INFERENCE_API_KEY`
- `IMPEL_CLAUDE_TRANSPORT` (`model-stream` or `workflow`)
- `IMPEL_ALLOW_LOCAL_PROVIDER_FALLBACK`
- `IMPEL_ORG_ID`
- `IMPEL_RUN_REPOS`
- `IMPEL_RUN_BRANCH`
- `IMPEL_RUN_INSTALLATION_ID`
- `IMPEL_RUN_ID`
- `IMPEL_RUN_TRACE_ID`
- `IMPEL_RUN_AGENT`

You can override `baseUrl`, `apiKey`, `orgId`, request `headers`, and
`runContext` in code.

## Auth

This package does not contain credentials and does not grant access to
`impel-inference`. Every inference request requires a bearer token via `apiKey`
or `IMPEL_INFERENCE_API_KEY`; calls fail locally before `fetch` when the key is
missing. The service also enforces the bearer token on `/v1/infer`,
`/v1/infer/start`, and `/v1/infer/runs/:runId/stream`.
Stream resumes include the resolved `orgId` as both `x-impel-org-id` and an
`orgId` query parameter so the service can verify the run belongs to that org
before tailing it.

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

This provider extracts that sentinel and forwards `orgId`, `repos`, `branch`,
`installationId`, `runId`, `traceId`, and `agent` to `impel-inference`. That
keeps per-run repository and trace context out of global process state.

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
