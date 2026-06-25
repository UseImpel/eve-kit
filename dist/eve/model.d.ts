import type { LanguageModelV3 } from "@ai-sdk/provider";
import { type ClaudeCodeModelId, type ClaudeCodeSettings } from "ai-sdk-provider-claude-code";
import { type ImpelInferenceHeaders, type ImpelInferenceOptions, type ImpelInferenceRunContextProvider } from "../index.js";
export declare const IMPEL_CLAUDE_CONTEXT_WINDOW_TOKENS = 200000;
export declare const IMPEL_DEFAULT_CLAUDE_MODEL_ID = "claude-opus-4-8";
export declare const IMPEL_CODEX_CONTEXT_WINDOW_TOKENS = 200000;
export declare const IMPEL_DEFAULT_CODEX_MODEL_ID = "gpt-5.5";
export declare const IMPEL_DEFAULT_OPENAI_RESPONSES_MODEL_ID = "gpt-5.5";
export interface ImpelClaudeProviderOptionsInput {
    providerOptions?: ClaudeCodeSettings;
    localProviderOptions?: ClaudeCodeSettings;
    permissionMode?: ClaudeCodeSettings["permissionMode"];
    allowDangerouslySkipPermissions?: boolean;
    effort?: ClaudeCodeSettings["effort"];
    cwd?: string;
}
export interface ImpelClaudeModelOptions extends Omit<ImpelInferenceOptions, "providerOptions">, ImpelClaudeProviderOptionsInput {
    modelId?: string;
    defaultModelId?: string;
    localModel?: ClaudeCodeModelId;
    defaultLocalModel?: ClaudeCodeModelId;
    allowLocalProviderFallback?: boolean;
    headers?: ImpelInferenceHeaders;
    runContext?: ImpelInferenceRunContextProvider;
}
export interface ImpelCodexProviderOptionsInput {
    providerOptions?: Record<string, unknown>;
    approvalMode?: string;
    sandboxMode?: string;
    skipGitRepoCheck?: boolean;
    effort?: string;
}
export interface ImpelCodexModelOptions extends Omit<ImpelInferenceOptions, "providerOptions" | "provider">, ImpelCodexProviderOptionsInput {
    modelId?: string;
    defaultModelId?: string;
    headers?: ImpelInferenceHeaders;
    runContext?: ImpelInferenceRunContextProvider;
}
export interface ImpelOpenAIResponsesModelOptions extends ImpelCodexModelOptions {
}
export declare function createImpelClaudeProviderOptions({ providerOptions, permissionMode, allowDangerouslySkipPermissions, effort, cwd, }?: ImpelClaudeProviderOptionsInput): ClaudeCodeSettings;
export declare function resolveImpelClaudeModelId({ modelId, defaultModelId, }?: {
    modelId?: string;
    defaultModelId?: string;
}): string;
export declare function createImpelCodexProviderOptions({ providerOptions, approvalMode, sandboxMode, skipGitRepoCheck, effort, }?: ImpelCodexProviderOptionsInput): Record<string, unknown>;
export declare function resolveImpelCodexModelId({ modelId, defaultModelId, }?: {
    modelId?: string;
    defaultModelId?: string;
}): string;
export declare function resolveImpelOpenAIResponsesModelId({ modelId, defaultModelId, }?: {
    modelId?: string;
    defaultModelId?: string;
}): string;
export declare function inferClaudeCodeLocalModel(modelId: string, fallback?: ClaudeCodeModelId): ClaudeCodeModelId;
export declare function createImpelClaudeModel(options?: ImpelClaudeModelOptions): LanguageModelV3;
export declare function createImpelCodexModel(options?: ImpelCodexModelOptions): LanguageModelV3;
export declare function createImpelOpenAIResponsesModel(options?: ImpelOpenAIResponsesModelOptions): LanguageModelV3;
//# sourceMappingURL=model.d.ts.map