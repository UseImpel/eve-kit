import { type ToolContext, type ToolDefinition } from "eve/tools";
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
export interface DefineImpelWorkspaceToolOptions {
    /**
     * Appended to the Eve default description. The tool still prepares and guards
     * attached Impel repositories before delegating to the Eve default executor.
     */
    description?: string;
    mode?: WorkspaceToolMode;
}
/**
 * Factory for an Eve `bash` tool that prepares the attached Impel workspace and
 * denies commands targeting paths outside verified `/workspace` checkouts.
 *
 * Usage: `export default defineImpelBashTool()`.
 */
export declare function defineImpelBashTool(options?: DefineImpelWorkspaceToolOptions): ToolDefinition;
/**
 * Factory for an Eve `glob` tool guarded to verified Impel workspace paths.
 *
 * Usage: `export default defineImpelGlobTool()`.
 */
export declare function defineImpelGlobTool(options?: DefineImpelWorkspaceToolOptions): ToolDefinition;
/**
 * Factory for an Eve `grep` tool guarded to verified Impel workspace paths.
 *
 * Usage: `export default defineImpelGrepTool()`.
 */
export declare function defineImpelGrepTool(options?: DefineImpelWorkspaceToolOptions): ToolDefinition;
/**
 * Factory for an Eve `read_file` tool guarded to verified Impel workspace paths.
 *
 * Usage: `export default defineImpelReadFileTool()`.
 */
export declare function defineImpelReadFileTool(options?: DefineImpelWorkspaceToolOptions): ToolDefinition;
/**
 * Factory for an Eve `write_file` tool guarded to verified Impel workspace paths.
 *
 * Usage: `export default defineImpelWriteFileTool()`.
 */
export declare function defineImpelWriteFileTool(options?: DefineImpelWorkspaceToolOptions): ToolDefinition;
/**
 * Factory for the `impel_workspace_context` tool. It prepares the attached Eve
 * workspace and returns the verified repository checkout paths for other tools.
 *
 * Usage: `export default defineImpelWorkspaceContextTool()`.
 */
export declare function defineImpelWorkspaceContextTool(options?: Pick<DefineImpelWorkspaceToolOptions, "description">): ToolDefinition;
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