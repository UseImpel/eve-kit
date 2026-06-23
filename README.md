# @useimpel/ai-sdk-provider-impel-inference

AI SDK provider for Impel's durable inference service.

This package implements the AI SDK `LanguageModelV3` interface used by Eve. It
forwards provider-level prompts to `impel-inference`, reads the durable SSE
stream, reconnects by run id when needed, and passes provider stream parts back
to Eve without reshaping them.

## Install

```sh
npm install https://github.com/UseImpel/ai-sdk-provider-impel-inference/archive/refs/tags/v0.1.3.tar.gz
```

## Usage

```ts
import { defineAgent } from "eve";
import { claudeCode } from "ai-sdk-provider-claude-code";
import { impelInference } from "@useimpel/ai-sdk-provider-impel-inference";

const providerOptions = {
  permissionMode: "bypassPermissions",
  allowDangerouslySkipPermissions: true,
  effort: "xhigh",
};

const model = process.env.IMPEL_INFERENCE_URL
  ? impelInference(process.env.IMPEL_MODEL_ID ?? "claude-opus-4-8", {
      providerOptions,
    })
  : claudeCode("opus", providerOptions);

export default defineAgent({ model, modelContextWindowTokens: 200000 });
```

The provider reads these environment variables by default:

- `IMPEL_INFERENCE_URL`
- `IMPEL_INFERENCE_API_KEY`
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
`impel-inference`. Every request requires a bearer token via `apiKey` or
`IMPEL_INFERENCE_API_KEY`; calls fail locally before `fetch` when the key is
missing. The service also enforces the bearer token on `/v1/infer`,
`/v1/infer/start`, and `/v1/infer/runs/:runId/stream`.

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

impelInference("claude-opus-4-8", {
  headers: () => {
    const headers: Record<string, string> = {};
    propagation.inject(context.active(), headers);
    return headers;
  },
});
```

The provider preserves its own `authorization`, `content-type`, and `x-org-id`
headers so custom headers cannot override authentication.
