import type { ToolContext, ToolDefinition } from "eve/tools";
import { type ImpelEveChannelState, type ImpelEveRunContext, type ImpelPlannedRepoCheckout } from "./channel.js";
export type WorkspaceToolName = "bash" | "glob" | "grep" | "read_file" | "write_file";
export type WorkspaceToolMode = "read-only" | "read-write";
type WorkspaceResolveContext = {
    readonly session: {
        readonly id: string;
    };
    readonly channel?: {
        readonly metadata?: Readonly<Record<string, unknown>>;
    };
};
export type WorkspaceToolFailure = {
    ok: false;
    code: string;
    guidance: string[];
    message: string;
    requestedPaths: string[];
    toolName: WorkspaceToolName | "workspace";
    workspaceContext?: string;
};
export type RunWithPreparedWorkspaceOptions = {
    mode?: WorkspaceToolMode;
    toolName?: WorkspaceToolName;
};
export declare function runWithPreparedImpelWorkspace<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>, input: TInput, ctx: ToolContext, options?: RunWithPreparedWorkspaceOptions): Promise<TOutput | WorkspaceToolFailure>;
export declare function describePreparedImpelWorkspace(ctx: ToolContext): Promise<{
    ok: true;
    layout: ImpelEveChannelState["workspace"]["layout"];
    message: string;
    repos: readonly ImpelPlannedRepoCheckout[];
    workspacePrepared: boolean;
} | WorkspaceToolFailure>;
export declare function rememberImpelWorkspaceRunContext(ctx: WorkspaceResolveContext): ImpelEveRunContext | undefined;
export {};
//# sourceMappingURL=workspace-tools.d.ts.map