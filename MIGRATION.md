# Migrating to eve-kit 1.0

Version 1 replaces environment-selected inference and local harness behavior
with one explicit, conventional Impel gateway model. Eve always owns the tool
loop on the default path.

## Agent changes

1. Pin `@useimpel/eve-kit` to the repository's GitHub tag tarball:
   `https://github.com/UseImpel/eve-kit/archive/refs/tags/v1.0.3.tar.gz`.
   This repository's current release convention is GitHub tag tarballs, not the
   npm registry.
2. Set `IMPEL_GATEWAY_URL` and provide the signed per-run token as
   `clientContext.runToken`. `IMPEL_GATEWAY_TOKEN` is suitable for a local pilot
   or break-glass PAT.
   When attached-repository prep uses `IMPEL_IDENTITY_URL`, also provide the
   separate server-only v1 assertion as `clientContext.identityRunToken`.
   `runToken` is gateway-audience v2 and is never sent to impel-identity; a
   legacy v1 `runToken` remains an identity fallback only when
   `identityRunToken` is absent.
3. Prefer `impelGatewayModel("<bare-model-id>")` from the root package. Existing
   `createImpelClaudeModel`, `createImpelCodexModel`, and
   `createImpelOpenAIResponsesModel` calls remain thin compatibility shims.
4. Remove archived inference-service environment variables and native CLI
   bundling workarounds. There is no implicit local-provider fallback.
5. Run a real tool-using task with structured output and confirm the run appears
   in gateway usage and pool-health views before migrating another agent.

Historical permission, approval, sandbox, working-directory, and local-model
options on compatibility shims are deprecated no-ops. Configure those policies
in Eve's agent, tools, and sandbox definitions instead.

Both capability tokens must stay on the Next → Eve → gateway/identity server
path and must never be exposed to browser clients. If centralized identity
resolution is selected with an identity assertion, HTTP, network, or empty
response failures stop workspace credential resolution; eve-kit does not fall
through to static, Connect, or GitHub App credentials.

## Model IDs

Use bare IDs such as `claude-sonnet-4-6` or `gpt-5.5`. The short Claude aliases
`fable`, `opus`, `sonnet`, and `haiku` remain supported. Provider prefixes are
accepted for compatibility but are removed before the request reaches the
gateway.

OpenAI Responses calls are forced to `store: false`; do not override that
setting. This lets Eve replay encrypted reasoning and tool history without
depending on upstream response persistence.

## Explicit CLI mode

The optional CLI boundary is
`@useimpel/eve-kit/eve/cli-runner`. Version 1 intentionally ships a fail-closed
stub while the Agent-SDK bridge for Eve tools, hooks, permissions, and structured
output is designed. The subpath is not included in either default barrel.

## Rollout inventory

Migrate and validate one deployment at a time, starting with the least critical:

- UseImpel system agents: background-agent, meeting-agent, research-agent
- UseImpel platform-engineer
- 3ScreensCapital platform-engineer and quant agents
- Creador Foundation, Creador Foundation Malaysia, and Creador Fund agents
- wiki-maintainer agents with nested model calls
- impel-ingestion

Fable capacity may be unavailable (`model_not_entitled`); choose a model with a
healthy pool seat before broad rollout. To roll back an agent, restore its prior
eve-kit pin and prior environment contract, then redeploy that agent only.
