import type { LanguageModel } from "ai";
import { type ImpelGatewayHeaders, type ImpelGatewayRunContextProvider } from "../gateway-model.js";
export declare const IMPEL_CLAUDE_CONTEXT_WINDOW_TOKENS = 200000;
export declare const IMPEL_DEFAULT_CLAUDE_MODEL_ID = "claude-opus-4-8";
export declare const IMPEL_CODEX_CONTEXT_WINDOW_TOKENS = 200000;
export declare const IMPEL_DEFAULT_CODEX_MODEL_ID = "gpt-5.5";
export declare const IMPEL_DEFAULT_OPENAI_RESPONSES_MODEL_ID = "gpt-5.5";
export interface ImpelClaudeProviderOptionsInput {
    providerOptions?: Record<string, unknown>;
    /** @deprecated The API provider does not launch a local harness. */
    localProviderOptions?: Record<string, unknown>;
    /** @deprecated Permissions are owned by Eve's sandbox. */
    permissionMode?: string;
    /** @deprecated Permissions are owned by Eve's sandbox. */
    allowDangerouslySkipPermissions?: boolean;
    effort?: string;
    /** @deprecated Working directories are owned by Eve's sandbox. */
    cwd?: string;
}
export interface ImpelClaudeModelOptions extends ImpelClaudeProviderOptionsInput {
    modelId?: string;
    defaultModelId?: string;
    gatewayUrl?: string;
    authToken?: string;
    /** @deprecated Use authToken. */
    gatewayAuthToken?: string;
    /** @deprecated Use authToken. */
    gatewayPat?: string;
    headers?: ImpelGatewayHeaders;
    runContext?: ImpelGatewayRunContextProvider;
    fetch?: typeof globalThis.fetch;
    /** @deprecated The v1 model has no implicit local-provider fallback. */
    localModel?: string;
    /** @deprecated The v1 model has no implicit local-provider fallback. */
    defaultLocalModel?: string;
    /** @deprecated The v1 model has no implicit local-provider fallback. */
    allowLocalProviderFallback?: boolean;
    /** @deprecated The archived inference service is no longer supported. */
    baseUrl?: string;
    /** @deprecated The archived inference service is no longer supported. */
    apiKey?: string;
    /** @deprecated Org identity comes from the signed run token. */
    orgId?: string;
    /** @deprecated This model always uses the conventional gateway API. */
    provider?: string;
    /** @deprecated Retained as a no-op compatibility field. */
    label?: string;
    /** @deprecated Retained as a no-op compatibility field. */
    streamReasoning?: boolean;
}
export interface ImpelCodexProviderOptionsInput {
    providerOptions?: Record<string, unknown>;
    /** @deprecated Permissions are owned by Eve's sandbox. */
    approvalMode?: string;
    /** @deprecated Permissions are owned by Eve's sandbox. */
    sandboxMode?: string;
    /** @deprecated The API provider does not launch a local harness. */
    skipGitRepoCheck?: boolean;
    effort?: string;
}
export interface ImpelCodexModelOptions extends ImpelCodexProviderOptionsInput {
    modelId?: string;
    defaultModelId?: string;
    gatewayUrl?: string;
    authToken?: string;
    /** @deprecated Use authToken. */
    gatewayAuthToken?: string;
    /** @deprecated Use authToken. */
    gatewayPat?: string;
    headers?: ImpelGatewayHeaders;
    runContext?: ImpelGatewayRunContextProvider;
    fetch?: typeof globalThis.fetch;
    /** @deprecated The archived inference service is no longer supported. */
    baseUrl?: string;
    /** @deprecated The archived inference service is no longer supported. */
    apiKey?: string;
    /** @deprecated Org identity comes from the signed run token. */
    orgId?: string;
    /** @deprecated Retained as a no-op compatibility field. */
    label?: string;
}
export type ImpelOpenAIResponsesModelOptions = ImpelCodexModelOptions;
export declare function resolveImpelModelId(envNames: readonly string[], defaultModelId: string): string;
export declare function resolveImpelClaudeModelId({ modelId, defaultModelId, }?: {
    modelId?: string;
    defaultModelId?: string;
}): string;
export declare function resolveImpelCodexModelId({ modelId, defaultModelId, }?: {
    modelId?: string;
    defaultModelId?: string;
}): string;
export declare function resolveImpelOpenAIResponsesModelId({ modelId, defaultModelId, }?: {
    modelId?: string;
    defaultModelId?: string;
}): string;
/** @deprecated Pass AI SDK providerOptions directly to createImpelClaudeModel. */
export declare function createImpelClaudeProviderOptions({ providerOptions, effort, }?: ImpelClaudeProviderOptionsInput): Record<string, unknown>;
/** @deprecated Pass AI SDK providerOptions directly to createImpelCodexModel. */
export declare function createImpelCodexProviderOptions({ providerOptions, effort, }?: ImpelCodexProviderOptionsInput): Record<string, unknown>;
/**
 * Backward-compatible name for the default pure-Eve gateway model.
 * No environment-dependent provider or local harness fallback remains.
 */
export declare function createImpelClaudeModel(options?: ImpelClaudeModelOptions): LanguageModel;
/** Backward-compatible OpenAI Responses/Codex gateway model factory. */
export declare function createImpelCodexModel(options?: ImpelCodexModelOptions): LanguageModel;
export declare function createImpelOpenAIResponsesModel(options?: ImpelOpenAIResponsesModelOptions): LanguageModel;
//# sourceMappingURL=model.d.ts.map