import { claudeCode, } from "ai-sdk-provider-claude-code";
import { impelInference, } from "../index.js";
export const IMPEL_CLAUDE_CONTEXT_WINDOW_TOKENS = 200000;
export const IMPEL_DEFAULT_CLAUDE_MODEL_ID = "claude-opus-4-8";
export const IMPEL_CODEX_CONTEXT_WINDOW_TOKENS = 200000;
export const IMPEL_DEFAULT_CODEX_MODEL_ID = "gpt-5.5";
export const IMPEL_DEFAULT_OPENAI_RESPONSES_MODEL_ID = IMPEL_DEFAULT_CODEX_MODEL_ID;
export function createImpelClaudeProviderOptions({ providerOptions, permissionMode = "bypassPermissions", allowDangerouslySkipPermissions = true, effort, cwd, } = {}) {
    return {
        permissionMode,
        allowDangerouslySkipPermissions,
        ...(effort ? { effort } : {}),
        ...(providerOptions ?? {}),
        ...(cwd ? { cwd } : {}),
    };
}
export function resolveImpelClaudeModelId({ modelId, defaultModelId = IMPEL_DEFAULT_CLAUDE_MODEL_ID, } = {}) {
    return modelId ?? process.env.IMPEL_MODEL_ID ?? defaultModelId;
}
export function createImpelCodexProviderOptions({ providerOptions, approvalMode = "never", sandboxMode = "workspace-write", skipGitRepoCheck = true, effort, } = {}) {
    return {
        approvalMode,
        sandboxMode,
        skipGitRepoCheck,
        ...(effort ? { effort } : {}),
        ...(providerOptions ?? {}),
    };
}
export function resolveImpelCodexModelId({ modelId, defaultModelId = IMPEL_DEFAULT_CODEX_MODEL_ID, } = {}) {
    return modelId ?? process.env.IMPEL_CODEX_MODEL_ID ?? defaultModelId;
}
export function resolveImpelOpenAIResponsesModelId({ modelId, defaultModelId = IMPEL_DEFAULT_OPENAI_RESPONSES_MODEL_ID, } = {}) {
    return (modelId ??
        process.env.IMPEL_OPENAI_RESPONSES_MODEL_ID ??
        process.env.IMPEL_CODEX_MODEL_ID ??
        defaultModelId);
}
export function inferClaudeCodeLocalModel(modelId, fallback = "opus") {
    if (/sonnet/i.test(modelId))
        return "sonnet";
    if (/haiku/i.test(modelId))
        return "haiku";
    return fallback;
}
/**
 * Is this a deployed Vercel serverless runtime (as opposed to local dev)?
 *
 * We key off `VERCEL_ENV` rather than `VERCEL` on purpose. Vercel sets
 * `VERCEL_ENV` to exactly "production" | "preview" | "development":
 *   - "production" / "preview" -> a real, remote deployment. There is NO Claude
 *     Code CLI and NO Anthropic OAuth credential here, so the local `claudeCode`
 *     provider can never work — it only throws a cryptic `AI_LoadAPIKeyError`
 *     deep in the tool loop.
 *   - "development" -> `vercel dev` running on a developer's machine, where the
 *     Claude Code CLI IS available, so `claudeCode` is valid.
 *
 * `VERCEL` (==="1") is deliberately NOT used as the signal: it is also set by
 * `vercel dev` and during local builds, where claudeCode is valid. Treating
 * `VERCEL=1` as "deployed" would break local development — the exact thing we
 * must not do. Keying off production/preview only is the conservative choice:
 * the loud failure can only fire on a real remote deploy, never locally.
 */
function isDeployedServerlessRuntime() {
    return (process.env.VERCEL_ENV === "production" ||
        process.env.VERCEL_ENV === "preview");
}
function envBoolean(name) {
    const value = process.env[name]?.trim().toLowerCase();
    if (!value)
        return undefined;
    if (["1", "true", "yes", "on"].includes(value))
        return true;
    if (["0", "false", "no", "off"].includes(value))
        return false;
    return undefined;
}
function allowLocalProviderFallback(explicit) {
    if (explicit !== undefined)
        return explicit;
    const env = envBoolean("IMPEL_ALLOW_LOCAL_PROVIDER_FALLBACK");
    if (env !== undefined)
        return env;
    return process.env.NODE_ENV !== "production";
}
function resolveClaudeTransport(explicit) {
    if (explicit)
        return explicit;
    const value = process.env.IMPEL_CLAUDE_TRANSPORT?.trim();
    return value === "model-stream" || value === "workflow" ? value : undefined;
}
export function createImpelClaudeModel(options = {}) {
    const { modelId: explicitModelId, defaultModelId, localModel, defaultLocalModel = "opus", providerOptions, localProviderOptions, permissionMode, allowDangerouslySkipPermissions, effort, cwd, allowLocalProviderFallback: explicitAllowLocalProviderFallback, provider = "claude-code", ...inferenceOptions } = options;
    const transport = resolveClaudeTransport(inferenceOptions.transport);
    const modelId = resolveImpelClaudeModelId({
        modelId: explicitModelId,
        defaultModelId,
    });
    const resolvedProviderOptions = createImpelClaudeProviderOptions({
        providerOptions,
        permissionMode,
        allowDangerouslySkipPermissions,
        effort,
        cwd,
    });
    if (inferenceOptions.baseUrl ?? process.env.IMPEL_INFERENCE_URL) {
        return impelInference(modelId, {
            ...inferenceOptions,
            ...(transport ? { transport } : {}),
            provider,
            providerOptions: resolvedProviderOptions,
        });
    }
    // The durable impel-inference proxy was not selected (no baseUrl and no
    // IMPEL_INFERENCE_URL). The only remaining path is the local `claudeCode`
    // provider, which depends on the Claude Code CLI + Anthropic OAuth credentials
    // that exist ONLY in local development. In a deployed serverless runtime those
    // are absent, so claudeCode throws a late, cryptic `AI_LoadAPIKeyError` deep in
    // the tool loop (it surfaces as MODEL_CALL_FAILED / a chat stuck at "Starting
    // runtime") — a missing-env misconfiguration that is painful to diagnose.
    //
    // Fail loud and early instead, but ONLY when we are certain we are in a
    // deployed runtime (see isDeployedServerlessRuntime: production/preview only).
    // Local dev — plain `node`/`tsx`/`eve dev` (no VERCEL_ENV) and `vercel dev`
    // (VERCEL_ENV="development") — still falls through to claudeCode exactly as
    // before. `IMPEL_ALLOW_CLAUDE_CODE_FALLBACK=1` is an explicit escape hatch to
    // force the local provider even on a deploy.
    if (isDeployedServerlessRuntime() &&
        process.env.IMPEL_ALLOW_CLAUDE_CODE_FALLBACK !== "1") {
        throw new Error("IMPEL_INFERENCE_URL is not set — this deployed agent cannot reach " +
            "impel-inference, and the local claude-code provider only works in local " +
            "development (it requires the Claude Code CLI and Anthropic OAuth " +
            "credentials, which do not exist in a Vercel serverless runtime). Set " +
            "IMPEL_INFERENCE_URL (and IMPEL_INFERENCE_API_KEY) on this deployment, or " +
            "set IMPEL_ALLOW_CLAUDE_CODE_FALLBACK=1 to force the local provider.");
    }
    // Independent fallback gate (keyed on NODE_ENV / explicit option /
    // IMPEL_ALLOW_LOCAL_PROVIDER_FALLBACK). This also covers non-Vercel production
    // runtimes that isDeployedServerlessRuntime() cannot detect, and lets callers
    // force-disable the local provider via `allowLocalProviderFallback: false`.
    if (!allowLocalProviderFallback(explicitAllowLocalProviderFallback)) {
        throw new Error("IMPEL_INFERENCE_URL or baseUrl is required for createImpelClaudeModel in production. Set IMPEL_ALLOW_LOCAL_PROVIDER_FALLBACK=true only for explicit local development.");
    }
    return claudeCode(localModel ?? inferClaudeCodeLocalModel(modelId, defaultLocalModel), { ...resolvedProviderOptions, ...(localProviderOptions ?? {}) });
}
export function createImpelCodexModel(options = {}) {
    const { modelId: explicitModelId, defaultModelId, providerOptions, approvalMode, sandboxMode, skipGitRepoCheck, effort, transport = "model-stream", ...inferenceOptions } = options;
    const modelId = resolveImpelCodexModelId({
        modelId: explicitModelId,
        defaultModelId,
    });
    return impelInference(modelId, {
        ...inferenceOptions,
        transport,
        provider: transport === "model-stream" ? "codex-app-server" : "codex-cli",
        providerOptions: createImpelCodexProviderOptions({
            providerOptions,
            approvalMode,
            sandboxMode,
            skipGitRepoCheck,
            effort,
        }),
    });
}
export function createImpelOpenAIResponsesModel(options = {}) {
    return createImpelCodexModel({
        ...options,
        defaultModelId: options.defaultModelId ?? IMPEL_DEFAULT_OPENAI_RESPONSES_MODEL_ID,
        modelId: resolveImpelOpenAIResponsesModelId({
            modelId: options.modelId,
            defaultModelId: options.defaultModelId ?? IMPEL_DEFAULT_OPENAI_RESPONSES_MODEL_ID,
        }),
        transport: options.transport ?? "model-stream",
    });
}
//# sourceMappingURL=model.js.map