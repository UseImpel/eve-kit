import { defineTool, type ToolContext, type ToolDefinition } from "eve/tools";
import { z } from "zod";

export type SystemAgentToolName = string;

export interface SystemAgentBridgeCallOptions {
  baseUrl?: string;
  token?: string;
  fetch?: typeof fetch;
}

export interface DefineSystemAgentBridgeToolOptions<
  TSchema extends z.ZodType,
> extends SystemAgentBridgeCallOptions {
  description: string;
  inputSchema: TSchema;
}

export function impelBaseUrl(): string {
  const baseUrl =
    process.env.IMPEL_API_BASE_URL ??
    process.env.IMPEL_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return baseUrl.replace(/\/$/, "");
}

export function bridgeToken(): string | undefined {
  return (
    process.env.IMPEL_SYSTEM_AGENT_TOOL_TOKEN ??
    process.env.IMPEL_BACKGROUND_AGENT_TOOL_TOKEN
  );
}

export async function callSystemAgentTool(
  tool: SystemAgentToolName,
  input: unknown,
  ctx: ToolContext,
  options: SystemAgentBridgeCallOptions = {},
) {
  const token = options.token ?? bridgeToken();
  if (!token) {
    throw new Error(
      "IMPEL_SYSTEM_AGENT_TOOL_TOKEN or IMPEL_BACKGROUND_AGENT_TOOL_TOKEN is required",
    );
  }
  const session = ctx.session as typeof ctx.session & {
    continuationToken?: string;
  };

  const response = await (options.fetch ?? fetch)(
    `${options.baseUrl ?? impelBaseUrl()}/api/internal/system-agent/tool`,
    {
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
    },
  );

  const payload = (await response.json().catch(() => undefined)) as
    | { ok?: boolean; result?: unknown; error?: string }
    | undefined;
  if (!response.ok || payload?.ok === false) {
    throw new Error(
      payload?.error ??
        `System agent bridge failed: HTTP ${response.status} ${response.statusText}`,
    );
  }
  return payload?.result;
}

export function defineSystemAgentBridgeTool<TSchema extends z.ZodType>(
  toolName: SystemAgentToolName,
  {
    description,
    inputSchema,
    ...options
  }: DefineSystemAgentBridgeToolOptions<TSchema>,
): ToolDefinition<z.output<TSchema>, unknown> {
  return defineTool({
    description,
    inputSchema,
    async execute(input, ctx) {
      return callSystemAgentTool(toolName, input, ctx, options);
    },
  }) as unknown as ToolDefinition<z.output<TSchema>, unknown>;
}

export const defineImpelSystemAgentBridgeTool = defineSystemAgentBridgeTool;
