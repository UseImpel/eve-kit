import { defineTool } from "eve/tools";
export function impelBaseUrl() {
    const baseUrl = process.env.IMPEL_API_BASE_URL ??
        process.env.IMPEL_APP_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "http://localhost:3000";
    return baseUrl.replace(/\/$/, "");
}
export function bridgeToken() {
    return (process.env.IMPEL_SYSTEM_AGENT_TOOL_TOKEN ??
        process.env.IMPEL_BACKGROUND_AGENT_TOOL_TOKEN);
}
export async function callSystemAgentTool(tool, input, ctx, options = {}) {
    const token = options.token ?? bridgeToken();
    if (!token) {
        throw new Error("IMPEL_SYSTEM_AGENT_TOOL_TOKEN or IMPEL_BACKGROUND_AGENT_TOOL_TOKEN is required");
    }
    const session = ctx.session;
    const response = await (options.fetch ?? fetch)(`${options.baseUrl ?? impelBaseUrl()}/api/internal/system-agent/tool`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            tool,
            input,
            session: {
                id: session.id,
                continuationToken: session.continuationToken,
                auth: session.auth.current,
            },
        }),
    });
    const payload = (await response.json().catch(() => undefined));
    if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error ??
            `System agent bridge failed: HTTP ${response.status} ${response.statusText}`);
    }
    return payload?.result;
}
export function defineSystemAgentBridgeTool(toolName, { description, inputSchema, ...options }) {
    return defineTool({
        description,
        inputSchema,
        async execute(input, ctx) {
            return callSystemAgentTool(toolName, input, ctx, options);
        },
    });
}
export const defineImpelSystemAgentBridgeTool = defineSystemAgentBridgeTool;
//# sourceMappingURL=bridge.js.map