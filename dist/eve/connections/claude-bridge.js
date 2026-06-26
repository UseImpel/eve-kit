import { defineMcpClientConnection, } from "eve/connections";
export const IMPEL_CLAUDE_BRIDGE_DEFAULT_URL = "http://127.0.0.1:3100/sse";
export const IMPEL_CLAUDE_BRIDGE_READ_ONLY_TOOLS = [
    "claude_query",
    "claude_read_file",
    "claude_git_status",
];
export const IMPEL_CLAUDE_BRIDGE_EXECUTE_TOOL = "claude_execute";
export const IMPEL_CLAUDE_BRIDGE_DEFAULT_DESCRIPTION = "Optional Claude Code bridge MCP server for read-only consultation against an operator-managed Claude Code workspace. Prefer Eve's built-in sandbox tools for this run's attached repository.";
function envFlag(name) {
    const value = process.env[name]?.trim().toLowerCase();
    return value === "1" || value === "true" || value === "yes" || value === "on";
}
function defaultAllowedTools(includeExecuteTool) {
    if (!includeExecuteTool)
        return IMPEL_CLAUDE_BRIDGE_READ_ONLY_TOOLS;
    return [
        ...IMPEL_CLAUDE_BRIDGE_READ_ONLY_TOOLS,
        IMPEL_CLAUDE_BRIDGE_EXECUTE_TOOL,
    ];
}
export function impelClaudeBridgeConnection({ url = process.env.CLAUDE_BRIDGE_MCP_URL ?? IMPEL_CLAUDE_BRIDGE_DEFAULT_URL, token = process.env.CLAUDE_BRIDGE_MCP_TOKEN?.trim(), description = IMPEL_CLAUDE_BRIDGE_DEFAULT_DESCRIPTION, allowTools, includeExecuteTool = envFlag("CLAUDE_BRIDGE_MCP_ALLOW_EXECUTE"), } = {}) {
    const trimmedToken = token?.trim();
    return defineMcpClientConnection({
        url,
        description,
        ...(trimmedToken
            ? {
                auth: {
                    getToken: async () => ({ token: trimmedToken }),
                },
            }
            : {}),
        tools: {
            allow: allowTools ?? defaultAllowedTools(includeExecuteTool),
        },
    });
}
export const createImpelClaudeBridgeConnection = impelClaudeBridgeConnection;
export default impelClaudeBridgeConnection();
//# sourceMappingURL=claude-bridge.js.map