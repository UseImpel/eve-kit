import { type McpClientConnectionDefinition } from "eve/connections";
export declare const IMPEL_CLAUDE_BRIDGE_DEFAULT_URL = "http://127.0.0.1:3100/sse";
export declare const IMPEL_CLAUDE_BRIDGE_READ_ONLY_TOOLS: readonly ["claude_query", "claude_read_file", "claude_git_status"];
export declare const IMPEL_CLAUDE_BRIDGE_EXECUTE_TOOL = "claude_execute";
export declare const IMPEL_CLAUDE_BRIDGE_DEFAULT_DESCRIPTION = "Optional Claude Code bridge MCP server for read-only consultation against an operator-managed Claude Code workspace. Prefer Eve's built-in sandbox tools for this run's attached repository.";
export interface ImpelClaudeBridgeConnectionOptions {
    url?: string;
    token?: string | null;
    description?: string;
    allowTools?: readonly string[];
    includeExecuteTool?: boolean;
}
export declare function impelClaudeBridgeConnection({ url, token, description, allowTools, includeExecuteTool, }?: ImpelClaudeBridgeConnectionOptions): McpClientConnectionDefinition;
export declare const createImpelClaudeBridgeConnection: typeof impelClaudeBridgeConnection;
declare const _default: McpClientConnectionDefinition;
export default _default;
//# sourceMappingURL=claude-bridge.d.ts.map