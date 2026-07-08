import type { LanguageModelV3 } from "@ai-sdk/provider";
import { type ClaudeCodeModelId, type ClaudeCodeSettings } from "ai-sdk-provider-claude-code";
import { type CodexAppServerSettings } from "ai-sdk-provider-codex-cli";
import type { ImpelInferenceRunContextProvider } from "../index.js";
type JsonObject = Record<string, unknown>;
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
 * Runs Claude Code against impel-gateway's Anthropic-compatible endpoint.
 *
 * Hosted Eve agents should pass a signed run token in clientContext. Static PAT
 * auth is still accepted for local/dev callers, but the per-run token wins so
 * gateway usage can be attributed to the invoking run/user/agent.
 */
export declare function impelGatewayClaudeModel(modelId: string, opts: ImpelGatewayClaudeModelOptions): LanguageModelV3;
export declare function impelGatewayCodexModel(modelId: string, opts: ImpelGatewayCodexModelOptions): LanguageModelV3;
export declare function buildGatewayClaudeCodeSettings(args: {
    providerOptions?: JsonObject;
    gatewayUrl: string;
    pat: string;
    configDir: string;
}): ClaudeCodeSettings;
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