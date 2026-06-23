import { defineTool } from "eve/tools";
export function impelBaseUrl() {
    const raw = process.env.IMPEL_NEXT_URL ??
        process.env.IMPEL_API_BASE_URL ??
        process.env.IMPEL_APP_URL ??
        process.env.NEXT_PUBLIC_IMPEL_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const trimmed = raw.trim();
    if (!trimmed) {
        throw new Error("IMPEL_NEXT_URL or IMPEL_APP_URL is required for system-agent bridge tools.");
    }
    return trimmed.replace(/\/+$/, "");
}
export function bridgeToken() {
    const token = process.env.IMPEL_SYSTEM_AGENT_TOOL_TOKEN ??
        process.env.IMPEL_BACKGROUND_AGENT_TOOL_TOKEN;
    if (!token?.trim()) {
        throw new Error("IMPEL_SYSTEM_AGENT_TOOL_TOKEN is required for system-agent bridge tools.");
    }
    return token.trim();
}
function nativeAuth(ctx) {
    return ctx.session.auth?.current ?? ctx.session.auth?.initiator ?? undefined;
}
function errorResult(message) {
    return { ok: false, error: message };
}
export async function callSystemAgentTool(tool, input, ctx, options = {}) {
    const bridgeCtx = ctx;
    let response;
    try {
        response = await (options.fetch ?? fetch)(`${options.baseUrl ?? impelBaseUrl()}/api/internal/system-agent/tool`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${options.token ?? bridgeToken()}`,
            },
            body: JSON.stringify({
                eveSessionId: bridgeCtx.session.id,
                turnId: bridgeCtx.session.turn?.id,
                nativeAuth: nativeAuth(bridgeCtx),
                tool,
                input,
            }),
        });
    }
    catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
    }
    let envelope;
    try {
        envelope = (await response.json());
    }
    catch {
        const text = await response.text().catch(() => "");
        return errorResult(`Tool bridge returned HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    if (!response.ok) {
        return errorResult(envelope.ok ? `Tool bridge returned HTTP ${response.status}` : envelope.error);
    }
    return envelope.ok ? envelope.result : errorResult(envelope.error);
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