import { defineTool, type ToolContext, type ToolDefinition } from "eve/tools";
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

type BridgeToolContext = ToolContext & {
  session: ToolContext["session"] & {
    auth?: {
      current: BridgeAuthContext | null;
      initiator: BridgeAuthContext | null;
    };
    turn?: { id?: string };
  };
};

type BridgeEnvelope =
  | { ok: true; result: unknown }
  | { ok: false; error: string; code?: string };

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
  const raw =
    process.env.IMPEL_NEXT_URL ??
    process.env.IMPEL_API_BASE_URL ??
    process.env.IMPEL_APP_URL ??
    process.env.NEXT_PUBLIC_IMPEL_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(
      "IMPEL_NEXT_URL or IMPEL_APP_URL is required for system-agent bridge tools.",
    );
  }
  return trimmed.replace(/\/+$/, "");
}

export function bridgeToken(): string {
  const token =
    process.env.IMPEL_SYSTEM_AGENT_TOOL_TOKEN ??
    process.env.IMPEL_BACKGROUND_AGENT_TOOL_TOKEN;
  if (!token?.trim()) {
    throw new Error(
      "IMPEL_SYSTEM_AGENT_TOOL_TOKEN is required for system-agent bridge tools.",
    );
  }
  return token.trim();
}

function nativeAuth(ctx: BridgeToolContext): BridgeAuthContext | undefined {
  return ctx.session.auth?.current ?? ctx.session.auth?.initiator ?? undefined;
}

function errorResult(message: string) {
  return { ok: false, error: message };
}

export async function callSystemAgentTool(
  tool: SystemAgentToolName,
  input: unknown,
  ctx: ToolContext,
  options: SystemAgentBridgeCallOptions = {},
) {
  const bridgeCtx = ctx as BridgeToolContext;
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(
      `${options.baseUrl ?? impelBaseUrl()}/api/internal/system-agent/tool`,
      {
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
      },
    );
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }

  let envelope: BridgeEnvelope;
  try {
    envelope = (await response.json()) as BridgeEnvelope;
  } catch {
    const text = await response.text().catch(() => "");
    return errorResult(
      `Tool bridge returned HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
  }

  if (!response.ok) {
    return errorResult(
      envelope.ok ? `Tool bridge returned HTTP ${response.status}` : envelope.error,
    );
  }
  return envelope.ok ? envelope.result : errorResult(envelope.error);
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
