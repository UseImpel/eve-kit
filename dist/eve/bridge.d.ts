import { type ToolContext, type ToolDefinition } from "eve/tools";
import { z } from "zod";
export type SystemAgentToolName = string;
export type BridgeAuthContext = {
    attributes: Readonly<Record<string, string | readonly string[]>>;
    authenticator: string;
    issuer?: string;
    principalId: string;
    principalType: string;
    subject?: string;
};
export interface SystemAgentBridgeCallOptions {
    baseUrl?: string;
    token?: string;
    fetch?: typeof fetch;
}
export interface DefineSystemAgentBridgeToolOptions<TSchema extends z.ZodType> extends SystemAgentBridgeCallOptions {
    description: string;
    inputSchema: TSchema;
}
export declare function impelBaseUrl(): string;
export declare function bridgeToken(): string;
export declare function callSystemAgentTool(tool: SystemAgentToolName, input: unknown, ctx: ToolContext, options?: SystemAgentBridgeCallOptions): Promise<unknown>;
export declare function defineSystemAgentBridgeTool<TSchema extends z.ZodType>(toolName: SystemAgentToolName, { description, inputSchema, ...options }: DefineSystemAgentBridgeToolOptions<TSchema>): ToolDefinition<z.output<TSchema>, unknown>;
export declare const defineImpelSystemAgentBridgeTool: typeof defineSystemAgentBridgeTool;
//# sourceMappingURL=bridge.d.ts.map