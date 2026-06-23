import { claudeCode, } from "ai-sdk-provider-claude-code";
import { impelInference, } from "../index.js";
export const IMPEL_CLAUDE_CONTEXT_WINDOW_TOKENS = 200000;
export const IMPEL_DEFAULT_CLAUDE_MODEL_ID = "claude-opus-4-8";
export const IMPEL_CODEX_CONTEXT_WINDOW_TOKENS = 200000;
export const IMPEL_DEFAULT_CODEX_MODEL_ID = "gpt-5.5";
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
export function inferClaudeCodeLocalModel(modelId, fallback = "opus") {
    if (/sonnet/i.test(modelId))
        return "sonnet";
    if (/haiku/i.test(modelId))
        return "haiku";
    return fallback;
}
export function createImpelClaudeModel(options = {}) {
    const { modelId: explicitModelId, defaultModelId, localModel, defaultLocalModel = "opus", providerOptions, localProviderOptions, permissionMode, allowDangerouslySkipPermissions, effort, cwd, provider = "claude-code", ...inferenceOptions } = options;
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
            provider,
            providerOptions: resolvedProviderOptions,
        });
    }
    return claudeCode(localModel ?? inferClaudeCodeLocalModel(modelId, defaultLocalModel), { ...resolvedProviderOptions, ...(localProviderOptions ?? {}) });
}
export function createImpelCodexModel(options = {}) {
    const { modelId: explicitModelId, defaultModelId, providerOptions, approvalMode, sandboxMode, skipGitRepoCheck, effort, ...inferenceOptions } = options;
    const modelId = resolveImpelCodexModelId({
        modelId: explicitModelId,
        defaultModelId,
    });
    return impelInference(modelId, {
        ...inferenceOptions,
        provider: "codex-cli",
        providerOptions: createImpelCodexProviderOptions({
            providerOptions,
            approvalMode,
            sandboxMode,
            skipGitRepoCheck,
            effort,
        }),
    });
}
//# sourceMappingURL=model.js.map