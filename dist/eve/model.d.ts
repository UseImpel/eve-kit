import type { LanguageModelV3 } from "@ai-sdk/provider";
import { type ClaudeCodeModelId, type ClaudeCodeSettings } from "ai-sdk-provider-claude-code";
import { type ImpelInferenceHeaders, type ImpelInferenceOptions, type ImpelInferenceRunContextProvider } from "../index.js";
export declare const IMPEL_CLAUDE_CONTEXT_WINDOW_TOKENS = 200000;
export declare const IMPEL_DEFAULT_CLAUDE_MODEL_ID = "claude-opus-4-8";
export interface ImpelClaudeProviderOptionsInput {
    providerOptions?: ClaudeCodeSettings;
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
    headers?: ImpelInferenceHeaders;
    runContext?: ImpelInferenceRunContextProvider;
}
export declare function createImpelClaudeProviderOptions({ providerOptions, permissionMode, allowDangerouslySkipPermissions, effort, cwd, }?: ImpelClaudeProviderOptionsInput): ClaudeCodeSettings;
export declare function resolveImpelClaudeModelId({ modelId, defaultModelId, }?: {
    modelId?: string;
    defaultModelId?: string;
}): string;
export declare function inferClaudeCodeLocalModel(modelId: string, fallback?: ClaudeCodeModelId): ClaudeCodeModelId;
export declare function createImpelClaudeModel(options?: ImpelClaudeModelOptions): LanguageModelV3;
//# sourceMappingURL=model.d.ts.map