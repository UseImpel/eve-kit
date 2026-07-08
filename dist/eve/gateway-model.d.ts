import type { LanguageModelV3 } from "@ai-sdk/provider";
import { type ClaudeCodeSettings } from "ai-sdk-provider-claude-code";
type JsonObject = Record<string, unknown>;
export interface ImpelGatewayClaudeModelOptions {
    gatewayUrl: string;
    pat: string;
    providerOptions?: Record<string, unknown>;
    configDir?: string;
}
/**
 * Runs the local Claude Code provider against impel-gateway's
 * Anthropic-compatible endpoint instead of the impel-inference stream proxy.
 */
export declare function impelGatewayClaudeModel(modelId: string, opts: ImpelGatewayClaudeModelOptions): LanguageModelV3;
export declare function buildGatewayClaudeCodeSettings(args: {
    providerOptions?: JsonObject;
    gatewayUrl: string;
    pat: string;
    configDir: string;
}): ClaudeCodeSettings;
export {};
//# sourceMappingURL=gateway-model.d.ts.map