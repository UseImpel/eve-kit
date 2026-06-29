import { type Channel } from "eve/channels";
import type { SandboxSession } from "eve/sandbox";
export interface DefaultImpelEveChannelOptions {
    basicUser?: string;
    basicPassword?: string;
    includePlaceholderAuth?: boolean;
    prepareAttachedRepos?: boolean;
    checkoutDepth?: number;
    trustedVercelSubjects?: readonly string[];
}
export interface ImpelEveRunContext {
    orgId?: string;
    repos?: string[];
    branch?: string;
    installationId?: string | number;
    runId?: string;
    traceId?: string;
    agent?: Record<string, unknown>;
    btParent?: string;
}
export interface ImpelPreparedRepo {
    repo: string;
    path: string;
    ref: string;
    sha: string;
}
export type ImpelWorkspaceLayout = "single-repo-root" | "multi-repo-directory";
export interface ImpelPlannedRepoCheckout {
    repo: string;
    path: string;
    role: "primary" | "additional";
}
export interface ImpelEveChannelState {
    runContext: ImpelEveRunContext | null;
    workspace: {
        prepared: boolean;
        sandboxId: string | null;
        key: string | null;
        layout: ImpelWorkspaceLayout | null;
        repos: ImpelPreparedRepo[];
        error: string | null;
    };
}
export type ImpelEveChannel = Channel<ImpelEveChannelState, Record<string, never>, ImpelEveChannelMetadata>;
export type ImpelEveChannelMetadata = Record<string, unknown> & ImpelEveRunContext & {
    workspacePrepared: boolean;
};
export interface PrepareImpelEveWorkspaceOptions {
    checkoutDepth?: number;
    getSandbox: () => Promise<SandboxSession>;
}
export declare function defaultImpelEveChannel({ basicUser, basicPassword, includePlaceholderAuth, prepareAttachedRepos, checkoutDepth, trustedVercelSubjects, }?: DefaultImpelEveChannelOptions): ImpelEveChannel;
export declare function createImpelEveChannelState(runContext: ImpelEveRunContext | null): ImpelEveChannelState;
export declare function extractImpelEveRunContextFromRequest(request: Request): Promise<ImpelEveRunContext | null>;
export declare function normalizeImpelEveRunContext(value: unknown): ImpelEveRunContext | null;
export declare function normalizeClientContextMessages(value: unknown): string[] | undefined;
export declare function prepareImpelEveWorkspace(state: ImpelEveChannelState, options: PrepareImpelEveWorkspaceOptions): Promise<void>;
export declare function planImpelEveRepoCheckouts(repoNames: readonly string[]): ImpelPlannedRepoCheckout[];
export declare function createImpelWorkspaceContextMessage(runContext: ImpelEveRunContext | null): string | undefined;
export declare function resolveVercelConnectGitHubConnectorUid(value?: string | undefined): string;
export declare function createVercelConnectGitHubTokenParams(runContext: ImpelEveRunContext): Record<string, unknown>;
//# sourceMappingURL=channel.d.ts.map