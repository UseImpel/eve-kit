import { impelGatewayModel, } from "../gateway-model.js";
const ANTHROPIC_PROVIDER_OPTION_KEYS = new Set([
    "sendReasoning",
    "structuredOutputMode",
    "thinking",
    "disableParallelToolUse",
    "cacheControl",
    "metadata",
    "mcpServers",
    "container",
    "toolStreaming",
    "effort",
    "taskBudget",
    "speed",
    "inferenceGeo",
    "fallbacks",
    "anthropicBeta",
    "contextManagement",
]);
const OPENAI_PROVIDER_OPTION_KEYS = new Set([
    "conversation",
    "include",
    "instructions",
    "logprobs",
    "maxToolCalls",
    "metadata",
    "parallelToolCalls",
    "previousResponseId",
    "promptCacheKey",
    "promptCacheRetention",
    "reasoningEffort",
    "reasoningSummary",
    "safetyIdentifier",
    "serviceTier",
    "store",
    "passThroughUnsupportedFiles",
    "strictJsonSchema",
    "textVerbosity",
    "truncation",
    "user",
    "systemMessageMode",
    "forceReasoning",
    "contextManagement",
    "allowedTools",
]);
export const IMPEL_CLAUDE_CONTEXT_WINDOW_TOKENS = 200000;
export const IMPEL_DEFAULT_CLAUDE_MODEL_ID = "claude-opus-4-8";
export const IMPEL_CODEX_CONTEXT_WINDOW_TOKENS = 200000;
export const IMPEL_DEFAULT_CODEX_MODEL_ID = "gpt-5.5";
export const IMPEL_DEFAULT_OPENAI_RESPONSES_MODEL_ID = IMPEL_DEFAULT_CODEX_MODEL_ID;
export function resolveImpelModelId(envNames, defaultModelId) {
    for (const name of envNames) {
        const value = process.env[name]?.trim();
        if (value)
            return value;
    }
    return defaultModelId;
}
export function resolveImpelClaudeModelId({ modelId, defaultModelId = IMPEL_DEFAULT_CLAUDE_MODEL_ID, } = {}) {
    return modelId ?? resolveImpelModelId(["IMPEL_MODEL_ID"], defaultModelId);
}
export function resolveImpelCodexModelId({ modelId, defaultModelId = IMPEL_DEFAULT_CODEX_MODEL_ID, } = {}) {
    return (modelId ?? resolveImpelModelId(["IMPEL_CODEX_MODEL_ID"], defaultModelId));
}
export function resolveImpelOpenAIResponsesModelId({ modelId, defaultModelId = IMPEL_DEFAULT_OPENAI_RESPONSES_MODEL_ID, } = {}) {
    return (modelId ??
        resolveImpelModelId(["IMPEL_OPENAI_RESPONSES_MODEL_ID", "IMPEL_CODEX_MODEL_ID"], defaultModelId));
}
/** @deprecated Pass AI SDK providerOptions directly to createImpelClaudeModel. */
export function createImpelClaudeProviderOptions({ providerOptions, effort, } = {}) {
    return normalizeProviderOptions("anthropic", providerOptions, effort);
}
/** @deprecated Pass AI SDK providerOptions directly to createImpelCodexModel. */
export function createImpelCodexProviderOptions({ providerOptions, effort, } = {}) {
    return normalizeProviderOptions("openai", providerOptions, effort);
}
/**
 * Backward-compatible name for the default pure-Eve gateway model.
 * No environment-dependent provider or local harness fallback remains.
 */
export function createImpelClaudeModel(options = {}) {
    const modelId = resolveImpelClaudeModelId(options);
    return impelGatewayModel(modelId, gatewayOptions(options, "anthropic"));
}
/** Backward-compatible OpenAI Responses/Codex gateway model factory. */
export function createImpelCodexModel(options = {}) {
    const modelId = resolveImpelCodexModelId(options);
    return impelGatewayModel(modelId, gatewayOptions(options, "openai"));
}
export function createImpelOpenAIResponsesModel(options = {}) {
    return createImpelCodexModel({
        ...options,
        modelId: resolveImpelOpenAIResponsesModelId(options),
    });
}
function gatewayOptions(options, provider) {
    return {
        gatewayUrl: options.gatewayUrl,
        authToken: options.authToken ?? options.gatewayAuthToken ?? options.gatewayPat,
        headers: options.headers,
        runContext: options.runContext,
        fetch: options.fetch,
        providerOptions: normalizeProviderOptions(provider, options.providerOptions, options.effort),
    };
}
function normalizeProviderOptions(provider, options, effort) {
    const source = options ?? {};
    const aliases = provider === "anthropic"
        ? ["anthropic", "claude", "claude_code", "claude-code"]
        : ["openai", "codex", "codex_cli", "codex-app-server"];
    const allowedKeys = provider === "anthropic"
        ? ANTHROPIC_PROVIDER_OPTION_KEYS
        : OPENAI_PROVIDER_OPTION_KEYS;
    const providerOptions = {
        ...(effort
            ? provider === "anthropic"
                ? { effort }
                : { reasoningEffort: effort }
            : {}),
    };
    for (const alias of aliases) {
        const scoped = source[alias];
        if (isJsonObject(scoped))
            Object.assign(providerOptions, scoped);
    }
    for (const [key, value] of Object.entries(source)) {
        if (allowedKeys.has(key))
            providerOptions[key] = value;
    }
    return Object.keys(providerOptions).length
        ? { [provider]: providerOptions }
        : {};
}
function isJsonObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=model.js.map