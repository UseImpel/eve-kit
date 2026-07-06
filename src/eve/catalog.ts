// Machine-readable catalog of the providers this package ships for Impel eve
// agent bundles. This is the single discovery source for tooling (e.g. the
// Agent Creator): enumerate EVE_KIT_PROVIDERS instead of grepping src/.

export type EveKitProviderKind =
  | "channel"
  | "connection"
  | "tool"
  | "sandbox"
  | "eval"
  | "model";

export interface EveKitProviderEnvVar {
  name: string;
  required: boolean;
  sensitive: boolean;
  purpose: string;
}

export interface EveKitProvider {
  /** stable slug, e.g. 'whatsapp-channel' */
  id: string;
  kind: EveKitProviderKind;
  /** e.g. '@useimpel/eve-kit/eve/whatsapp' — must match a package.json exports subpath */
  importPath: string;
  exportName: string;
  summary: string;
  envVars: EveKitProviderEnvVar[];
  setupSteps: string[];
  /** eve-kit version that introduced it, e.g. '0.2.45' */
  sinceVersion: string;
  /** for kind==='channel': the platform channel kind it backs, e.g. 'whatsapp' | 'eve' | 'telegram' */
  channelKind?: string;
}

export const EVE_KIT_PROVIDERS: readonly EveKitProvider[] = [
  {
    id: "impel-eve-channel",
    kind: "channel",
    importPath: "@useimpel/eve-kit/eve/channel",
    exportName: "defaultImpelEveChannel",
    summary:
      "Default HTTP channel for Impel eve agents: message/session routes with localDev + Vercel OIDC (+ optional HTTP basic) auth, Impel run-context extraction from clientContext, and /workspace preparation that checks out attached GitHub repos into the sandbox (token via impel-identity, Vercel Connect, GitHub App installation, or a static token).",
    envVars: [
      {
        name: "EVE_APP_BASIC_USER",
        required: false,
        sensitive: false,
        purpose:
          "HTTP basic auth username for the channel routes (IMPEL_EVE_BASIC_USER is an accepted fallback). Basic auth is only enabled when both user and password are set.",
      },
      {
        name: "EVE_APP_BASIC_PASSWORD",
        required: false,
        sensitive: true,
        purpose:
          "HTTP basic auth password for the channel routes (IMPEL_EVE_BASIC_PASSWORD is an accepted fallback).",
      },
      {
        name: "IMPEL_IDENTITY_URL",
        required: false,
        sensitive: false,
        purpose:
          "Base URL of the impel-identity service for centralized GitHub token resolution during workspace prep; only used when the dispatcher also sent a signed run token.",
      },
      {
        name: "IMPEL_EVE_GITHUB_TOKEN",
        required: false,
        sensitive: true,
        purpose:
          "Static GitHub token for attached-repo checkouts (GITHUB_TOKEN and GH_TOKEN are accepted fallbacks). Wins over Vercel Connect and GitHub App resolution.",
      },
      {
        name: "VERCEL_GITHUB_CONNECTOR_UID",
        required: false,
        sensitive: false,
        purpose:
          "Vercel Connect GitHub connector UID used to mint installation tokens (defaults to 'github/useimpel-github').",
      },
      {
        name: "IMPEL_EVE_GITHUB_CONNECT_ENABLED",
        required: false,
        sensitive: false,
        purpose:
          "Set to '0' to disable Vercel Connect GitHub token minting during workspace prep.",
      },
      {
        name: "IMPEL_EVE_GITHUB_APP_ID",
        required: false,
        sensitive: false,
        purpose:
          "GitHub App id for the installation-token fallback when clientContext carries an installationId (GITHUB_APP_ID is an accepted fallback).",
      },
      {
        name: "IMPEL_EVE_GITHUB_APP_PRIVATE_KEY",
        required: false,
        sensitive: true,
        purpose:
          "GitHub App private key (PEM) for the installation-token fallback (GITHUB_APP_PRIVATE_KEY is an accepted fallback).",
      },
      {
        name: "IMPEL_EVE_GITHUB_API_URL",
        required: false,
        sensitive: false,
        purpose:
          "GitHub API base URL override for installation-token minting (defaults to https://api.github.com).",
      },
      {
        name: "IMPEL_EVE_GITHUB_CHECKOUT_DEPTH",
        required: false,
        sensitive: false,
        purpose:
          "Default shallow-clone depth for attached-repo checkouts when the channel options do not set checkoutDepth.",
      },
    ],
    setupSteps: [
      "Export it as the agent's channel, e.g. `export default defaultImpelEveChannel();` in agent/channels/impel.ts.",
      "If runs attach GitHub repos, provide one credential path: impel-identity (IMPEL_IDENTITY_URL + signed run token), Vercel Connect, GitHub App env, or a static token.",
      "Optionally set EVE_APP_BASIC_USER/EVE_APP_BASIC_PASSWORD to add HTTP basic auth for non-OIDC callers.",
    ],
    sinceVersion: "0.2.0",
    channelKind: "eve",
  },
  {
    id: "whatsapp-channel",
    kind: "channel",
    importPath: "@useimpel/eve-kit/eve/whatsapp",
    exportName: "whatsappChannel",
    summary:
      "Whapi.Cloud WhatsApp channel — a native eve defineChannel provider authored like eve's telegramChannel. Verifies inbound Whapi webhooks (POST /eve/v1/whatsapp by default), hands user messages to onMessage to dispatch durable turns, and delivers replies with typing indicators, WhatsApp-rendered markdown, interactive-button HITL, and error surfacing.",
    envVars: [
      {
        name: "WHAPI_TOKEN",
        required: true,
        sensitive: true,
        purpose:
          "Whapi.Cloud API bearer token; without it the channel is unprovisioned and inbound webhooks are rejected.",
      },
      {
        name: "WHAPI_CHANNEL_ID",
        required: true,
        sensitive: false,
        purpose:
          "Whapi.Cloud channel id backing this WhatsApp number; without it the channel is unprovisioned.",
      },
      {
        name: "WHAPI_API_URL",
        required: false,
        sensitive: false,
        purpose:
          "Whapi API base URL override (defaults to https://gate.whapi.cloud).",
      },
      {
        name: "WHAPI_WEBHOOK_SECRET",
        required: false,
        sensitive: true,
        purpose:
          "Shared secret for inbound webhook verification via `?secret=` query param or Bearer header; unset means webhooks are accepted unverified.",
      },
    ],
    setupSteps: [
      "Create a Whapi.Cloud channel for the WhatsApp number and copy its token and channel id.",
      "Set WHAPI_TOKEN and WHAPI_CHANNEL_ID (plus WHAPI_WEBHOOK_SECRET) on the agent deployment.",
      "Drop the channel into the bundle, e.g. agent/channels/whatsapp.ts: `export default whatsappChannel({ onMessage(ctx, message) { return { auth: null }; } });` — return null from onMessage to drop a message.",
      "Point the Whapi webhook at POST https://<agent-host>/eve/v1/whatsapp?secret=<WHAPI_WEBHOOK_SECRET>.",
    ],
    sinceVersion: "0.2.45",
    channelKind: "whatsapp",
  },
  {
    id: "telegram-helpers",
    kind: "channel",
    importPath: "@useimpel/eve-kit/eve/telegram",
    exportName: "sendTelegramMarkdownReply",
    summary:
      "Reply/formatting helpers layered on eve's native telegram channel (eve/channels/telegram) — not a standalone channel. Renders agent markdown as Telegram HTML (renderTelegramMarkdownAsHtml, createTelegramMarkdownSendMessageBody) and sends chunked replies with a plain-text fallback.",
    envVars: [],
    setupSteps: [
      "Wire eve's built-in telegramChannel from eve/channels/telegram as the agent's channel.",
      "Call sendTelegramMarkdownReply(ctx, markdown) from channel event handlers (e.g. message.completed) to deliver HTML-formatted replies.",
    ],
    sinceVersion: "0.2.35",
    channelKind: "telegram",
  },
  {
    id: "claude-bridge-connection",
    kind: "connection",
    importPath: "@useimpel/eve-kit/eve/connections/claude-bridge",
    exportName: "impelClaudeBridgeConnection",
    summary:
      "Optional MCP client connection to a Claude Code bridge server for read-only consultation against an operator-managed Claude Code workspace (claude_query, claude_read_file, claude_git_status; claude_execute only when explicitly enabled). Also exported as the module's default, pre-configured from env.",
    envVars: [
      {
        name: "CLAUDE_BRIDGE_MCP_URL",
        required: false,
        sensitive: false,
        purpose:
          "Bridge MCP server URL (defaults to http://127.0.0.1:3100/sse).",
      },
      {
        name: "CLAUDE_BRIDGE_MCP_TOKEN",
        required: false,
        sensitive: true,
        purpose: "Bearer token sent to the bridge MCP server when set.",
      },
      {
        name: "CLAUDE_BRIDGE_MCP_ALLOW_EXECUTE",
        required: false,
        sensitive: false,
        purpose:
          "Truthy flag ('1'/'true'/'yes'/'on') that additionally allows the claude_execute tool; default is read-only tools.",
      },
    ],
    setupSteps: [
      "Run an operator-managed Claude Code bridge MCP server reachable from the agent.",
      "Set CLAUDE_BRIDGE_MCP_URL (and CLAUDE_BRIDGE_MCP_TOKEN) on the deployment.",
      "Export the connection from the bundle, e.g. agent/connections/claude-bridge.ts: `export { default } from \"@useimpel/eve-kit/eve/connections/claude-bridge\";` or call impelClaudeBridgeConnection({...}) to customize.",
    ],
    sinceVersion: "0.2.19",
  },
  {
    id: "web-search-tool",
    kind: "tool",
    importPath: "@useimpel/eve-kit/eve/web-search-tool",
    exportName: "default",
    summary:
      "Shared web_search override for eve agents: an xAI-backed search tool (defineTool default export) that returns real, resolvable result URLs plus a source-backed synthesis, replacing eve's built-in provider web_search which has no local executor. Supports allowedDomains/excludedDomains and a per-call model override; times out gracefully instead of stalling the run.",
    envVars: [
      {
        name: "XAI_API_KEY",
        required: true,
        sensitive: true,
        purpose:
          "xAI API key consumed by the @ai-sdk/xai provider that executes the search.",
      },
      {
        name: "XAI_SEARCH_MODEL_ID",
        required: false,
        sensitive: false,
        purpose:
          "Default xAI model id for searches (falls back to XAI_SOCIAL_MODEL_ID, then grok-4.20-non-reasoning).",
      },
      {
        name: "XAI_SOCIAL_MODEL_ID",
        required: false,
        sensitive: false,
        purpose: "Secondary fallback xAI model id when XAI_SEARCH_MODEL_ID is unset.",
      },
    ],
    setupSteps: [
      "Set XAI_API_KEY on the agent deployment.",
      "Export it as the bundle's web_search tool, e.g. agent/tools/web_search.ts: `export { default } from \"@useimpel/eve-kit/eve/web-search-tool\";`.",
    ],
    sinceVersion: "0.2.39",
  },
  {
    id: "impel-default-sandbox",
    kind: "sandbox",
    importPath: "@useimpel/eve-kit/eve/sandbox",
    exportName: "impelDefaultSandbox",
    summary:
      "Default eve sandbox for Impel agents: eve's defaultBackend (Vercel node24, 2 vCPUs by default) with a bootstrap that installs workspace binaries (git, git-lfs, gh CLI, ripgrep, jq, curl, unzip) so workspace tools and repo checkouts work out of the box. Set installWorkspaceTools: false for a minimal sandbox.",
    envVars: [
      {
        name: "IMPEL_EVE_GH_CLI_VERSION",
        required: false,
        sensitive: false,
        purpose:
          "GitHub CLI version installed during sandbox bootstrap (defaults to 2.63.2); also feeds the sandbox revalidation key.",
      },
    ],
    setupSteps: [
      "Export it as the agent's sandbox, e.g. agent/sandbox.ts: `export default impelDefaultSandbox();`.",
    ],
    sinceVersion: "0.2.0",
  },
  {
    id: "impel-just-bash-sandbox",
    kind: "sandbox",
    importPath: "@useimpel/eve-kit/eve/sandbox",
    exportName: "impelJustBashSandbox",
    summary:
      "In-process just-bash eve sandbox for local development and tests — no remote backend and no workspace-tool bootstrap. Requires the optional just-bash peer dependency.",
    envVars: [],
    setupSteps: [
      "Install the just-bash peer dependency.",
      "Export it as the agent's sandbox, e.g. agent/sandbox.ts: `export default impelJustBashSandbox();`.",
    ],
    sinceVersion: "0.2.0",
  },
  {
    id: "impel-braintrust-eval-config",
    kind: "eval",
    importPath: "@useimpel/eve-kit/eve/evals",
    exportName: "createImpelBraintrustEvalConfig",
    summary:
      "Eval config factory (defineEvalConfig) that wires eve's Braintrust reporter with Impel conventions: project name, `<agentId>/<suffix>` experiment naming, and env overrides for CI runs.",
    envVars: [
      {
        name: "IMPEL_AGENT_ID",
        required: false,
        sensitive: false,
        purpose:
          "Agent id used in the default experiment name (overrides the defaultAgentId option).",
      },
      {
        name: "BRAINTRUST_PROJECT_NAME",
        required: false,
        sensitive: false,
        purpose: "Braintrust project name override (defaults to 'Impel').",
      },
      {
        name: "BRAINTRUST_EXPERIMENT_NAME",
        required: false,
        sensitive: false,
        purpose:
          "Braintrust experiment name override (defaults to '<agentId>/<defaultExperimentSuffix>').",
      },
      {
        name: "BRAINTRUST_EXPERIMENT_UPDATE",
        required: false,
        sensitive: false,
        purpose:
          "Set to 'true' to update an existing Braintrust experiment instead of creating a new one.",
      },
    ],
    setupSteps: [
      "Export it as the bundle's eval config, e.g. agent/evals/config.ts: `export default createImpelBraintrustEvalConfig({ defaultAgentId: \"<agent-id>\" });`.",
      "Provide Braintrust credentials for eve's Braintrust reporter in the eval environment.",
    ],
    sinceVersion: "0.2.0",
  },
  {
    id: "impel-smoke-eval",
    kind: "eval",
    importPath: "@useimpel/eve-kit/eve/evals",
    exportName: "createImpelSmokeEval",
    summary:
      "Standard smoke eval (defineEval) asserting the agent accepts a basic message and completes without failing, tagged and annotated with agentId/orgId/agentVersion/agentDigest metadata for reporting.",
    envVars: [
      {
        name: "IMPEL_AGENT_ID",
        required: false,
        sensitive: false,
        purpose: "Agent id recorded in eval tags/metadata (overrides defaultAgentId).",
      },
      {
        name: "IMPEL_ORG_ID",
        required: false,
        sensitive: false,
        purpose: "Org id recorded in eval tags/metadata (overrides defaultOrgId).",
      },
      {
        name: "IMPEL_AGENT_VERSION",
        required: false,
        sensitive: false,
        purpose: "Numeric agent version recorded in eval metadata when parseable.",
      },
      {
        name: "IMPEL_AGENT_DIGEST",
        required: false,
        sensitive: false,
        purpose: "Agent bundle digest recorded in eval metadata.",
      },
    ],
    setupSteps: [
      "Export it from the bundle's evals, e.g. agent/evals/smoke.eval.ts: `export default createImpelSmokeEval({ defaultAgentId: \"<agent-id>\", defaultOrgId: \"<org-id>\" });`.",
    ],
    sinceVersion: "0.2.0",
  },
  {
    id: "impel-inference-model",
    kind: "model",
    importPath: "@useimpel/eve-kit",
    exportName: "impelInference",
    summary:
      "AI SDK LanguageModelV3 provider that streams through Impel's durable impel-inference service instead of a direct model API. Forwards run context (orgId, repos, branch, installationId, runId/traceId, agent, signed run token) resolved from the prompt sentinel, configured providers, or IMPEL_RUN_* env fallbacks.",
    envVars: [
      {
        name: "IMPEL_INFERENCE_URL",
        required: true,
        sensitive: false,
        purpose:
          "Base URL of the impel-inference service (or pass baseUrl explicitly).",
      },
      {
        name: "IMPEL_INFERENCE_API_KEY",
        required: true,
        sensitive: true,
        purpose:
          "API key for impel-inference (or pass apiKey explicitly).",
      },
      {
        name: "IMPEL_ORG_ID",
        required: false,
        sensitive: false,
        purpose:
          "Fallback org id when no run context supplies one (defaults to 'default').",
      },
    ],
    setupSteps: [
      "Set IMPEL_INFERENCE_URL and IMPEL_INFERENCE_API_KEY on the deployment.",
      "Use it as the agent model, e.g. `impelInference(\"claude-opus-4-8\")` — or prefer the createImpelClaudeModel/createImpelCodexModel wrappers.",
    ],
    sinceVersion: "0.1.0",
  },
  {
    id: "impel-claude-model",
    kind: "model",
    importPath: "@useimpel/eve-kit/eve",
    exportName: "createImpelClaudeModel",
    summary:
      "Canonical Claude model wiring for agent bundles: routes through impelInference when IMPEL_INFERENCE_URL/baseUrl is set, and falls back to the local claude-code CLI provider only in local development (deployed runtimes fail loud instead of hitting a cryptic missing-credential error).",
    envVars: [
      {
        name: "IMPEL_INFERENCE_URL",
        required: false,
        sensitive: false,
        purpose:
          "Selects the durable impel-inference path; required in deployed runtimes, optional locally where the claude-code CLI fallback works.",
      },
      {
        name: "IMPEL_INFERENCE_API_KEY",
        required: false,
        sensitive: true,
        purpose: "API key used when routing through impel-inference.",
      },
      {
        name: "IMPEL_MODEL_ID",
        required: false,
        sensitive: false,
        purpose:
          "Model id override (defaults to claude-opus-4-8).",
      },
      {
        name: "IMPEL_ALLOW_CLAUDE_CODE_FALLBACK",
        required: false,
        sensitive: false,
        purpose:
          "Set to '1' to force the local claude-code provider even on a deployed Vercel runtime (escape hatch).",
      },
      {
        name: "IMPEL_ALLOW_LOCAL_PROVIDER_FALLBACK",
        required: false,
        sensitive: false,
        purpose:
          "Boolean flag gating the local-provider fallback independently of NODE_ENV.",
      },
    ],
    setupSteps: [
      "Export it as the agent model, e.g. agent/model.ts: `export default createImpelClaudeModel();`.",
      "Set IMPEL_INFERENCE_URL and IMPEL_INFERENCE_API_KEY on deployed environments.",
    ],
    sinceVersion: "0.2.0",
  },
  {
    id: "impel-codex-model",
    kind: "model",
    importPath: "@useimpel/eve-kit/eve",
    exportName: "createImpelCodexModel",
    summary:
      "Codex model wiring for agent bundles: always routes through impelInference with the codex-app-server provider and Impel's default approval/sandbox options (createImpelOpenAIResponsesModel is the OpenAI-Responses alias).",
    envVars: [
      {
        name: "IMPEL_INFERENCE_URL",
        required: true,
        sensitive: false,
        purpose: "Base URL of the impel-inference service.",
      },
      {
        name: "IMPEL_INFERENCE_API_KEY",
        required: true,
        sensitive: true,
        purpose: "API key for impel-inference.",
      },
      {
        name: "IMPEL_CODEX_MODEL_ID",
        required: false,
        sensitive: false,
        purpose: "Model id override (defaults to gpt-5.5).",
      },
    ],
    setupSteps: [
      "Set IMPEL_INFERENCE_URL and IMPEL_INFERENCE_API_KEY on the deployment.",
      "Use it as (or alongside) the agent model, e.g. `createImpelCodexModel()`.",
    ],
    sinceVersion: "0.2.0",
  },
  {
    id: "render-ui-tool",
    kind: "tool",
    importPath: "@useimpel/eve-kit/eve/render-ui",
    exportName: "renderUiTool",
    summary:
      "render_ui tool (also the module's default export) that lets an agent emit structured UI trees — Section, Callout, ActionList, Stat, Badge, KeyValue, CodeRef, SourceLink, Text, Chart — validated by the exported zod schemas and rendered client-side by Impel's generative-UI renderer. RENDER_UI_PROMPT is the matching instructions snippet.",
    envVars: [],
    setupSteps: [
      "Export it as the bundle's render_ui tool, e.g. agent/tools/render_ui.ts: `export { default } from \"@useimpel/eve-kit/eve/render-ui\";`.",
      "Include RENDER_UI_PROMPT in the agent instructions so the model knows the element grammar.",
    ],
    sinceVersion: "0.2.0",
  },
  {
    id: "impel-workspace-tools",
    kind: "tool",
    importPath: "@useimpel/eve-kit/eve/workspace-tools",
    exportName: "defineImpelBashTool",
    summary:
      "Workspace-guarded overrides of eve's default tools: defineImpelBashTool, defineImpelGlobTool, defineImpelGrepTool, defineImpelReadFileTool, defineImpelWriteFileTool, plus defineImpelWorkspaceContextTool. Each prepares the attached Impel repos under /workspace on first use and denies paths outside verified checkouts before delegating to the eve default executor. GitHub credentials come from the same env as impel-eve-channel workspace prep.",
    envVars: [],
    setupSteps: [
      "Export the factories as the bundle's tools, e.g. agent/tools/bash.ts: `export default defineImpelBashTool();` (and glob/grep/read_file/write_file siblings).",
      "Provide the same GitHub credential env as the impel-eve-channel provider so workspace prep can check out attached repos.",
    ],
    sinceVersion: "0.2.39",
  },
  {
    id: "query-wiki",
    kind: "tool",
    importPath: "@useimpel/eve-kit/eve",
    exportName: "queryWiki",
    summary:
      "Agent-facing wiki retrieval API: resolves an orgId to its wiki vault (injected resolver, IMPEL_WIKI_VAULT_MAP, or wikis/<orgId> convention), runs section-aware retrieval over the pre-built index, applies an evidence gate, and returns org-tagged chunks. Wrap it in a defineTool executor to expose it to the model.",
    envVars: [
      {
        name: "IMPEL_WIKI_VAULT_MAP",
        required: false,
        sensitive: false,
        purpose:
          "JSON object mapping orgId to a wiki vault path (or { path } object); falls back to the wikis/<orgId> convention.",
      },
    ],
    setupSteps: [
      "Make the org's pre-built wiki vault available at the resolved path (IMPEL_WIKI_VAULT_MAP or wikis/<orgId>).",
      "Call queryWiki(orgId, query, options) from a bundle tool executor and surface chunks plus the gate decision to the model.",
    ],
    sinceVersion: "0.2.40",
  },
];

export function getEveKitProvider(id: string): EveKitProvider | undefined {
  return EVE_KIT_PROVIDERS.find((provider) => provider.id === id);
}

export function listEveKitProviders(
  kind?: EveKitProviderKind,
): EveKitProvider[] {
  return kind
    ? EVE_KIT_PROVIDERS.filter((provider) => provider.kind === kind)
    : [...EVE_KIT_PROVIDERS];
}
