import { type AnthropicProviderSettings } from "@ai-sdk/anthropic";
import type { LanguageModelV3, LanguageModelV4CallOptions } from "@ai-sdk/provider";
import type { LanguageModel } from "ai";
import { type ClaudeCodeModelId, type ClaudeCodeSettings } from "ai-sdk-provider-claude-code";
import { type CodexAppServerSettings } from "ai-sdk-provider-codex-cli";
import type { ImpelInferenceRunContextProvider } from "../index.js";
type JsonObject = Record<string, unknown>;
type GatewayAnthropicCallConfig = {
    providerOptions?: LanguageModelV4CallOptions["providerOptions"];
};
export interface ImpelGatewayClaudeModelOptions {
    gatewayUrl: string;
    /**
     * Back-compat alias for static gateway auth. Per-run Eve clientContext.runToken
     * wins over this value at call time.
     */
    pat?: string;
    authToken?: string;
    providerOptions?: Record<string, unknown>;
    localModel?: ClaudeCodeModelId;
    defaultLocalModel?: ClaudeCodeModelId;
    runContext?: ImpelInferenceRunContextProvider;
    configDir?: string;
}
export interface ImpelGatewayCodexModelOptions {
    gatewayUrl: string;
    authToken?: string;
    providerOptions?: Record<string, unknown>;
    runContext?: ImpelInferenceRunContextProvider;
    codexHomeRoot?: string;
}
export declare function resolveImpelGatewayUrl(explicit?: string): string | undefined;
/**
 * Runs Anthropic Messages traffic through impel-gateway while keeping the normal
 * AI SDK/Eve tool loop intact. Hosted Eve agents should pass a signed run token
 * in clientContext. Static PAT auth is still accepted for local/dev callers, but
 * the per-run token wins so gateway usage can be attributed to the invoking
 * run/user/agent.
 */
export declare function impelGatewayClaudeModel(modelId: string, opts: ImpelGatewayClaudeModelOptions): LanguageModel;
export declare function impelGatewayCodexModel(modelId: string, opts: ImpelGatewayCodexModelOptions): LanguageModelV3;
export declare function buildGatewayClaudeCodeSettings(args: {
    providerOptions?: JsonObject;
    gatewayUrl: string;
    pat: string;
    configDir: string;
}): ClaudeCodeSettings;
export declare function buildGatewayAnthropicProviderSettings(args: {
    gatewayUrl: string;
    authToken: string;
    headers?: Record<string, string>;
}): AnthropicProviderSettings;
export declare function buildGatewayAnthropicCallConfig(providerOptions?: JsonObject): GatewayAnthropicCallConfig;
export declare function buildGatewayCodexAppServerSettings(args: {
    providerOptions?: JsonObject;
    gatewayUrl: string;
    authToken: string;
    orgId?: string;
    runId?: string;
    codexHomeRoot?: string;
}): CodexAppServerSettings;
export {};
//# sourceMappingURL=gateway-model.d.ts.map