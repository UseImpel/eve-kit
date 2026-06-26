import { type Channel } from "eve/channels";
export interface DefaultImpelEveChannelOptions {
    basicUser?: string;
    basicPassword?: string;
    includePlaceholderAuth?: boolean;
    prepareAttachedRepos?: boolean;
    checkoutDepth?: number;
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
export interface ImpelEveChannelState {
    runContext: ImpelEveRunContext | null;
    workspace: {
        prepared: boolean;
        sandboxId: string | null;
        repos: ImpelPreparedRepo[];
        error: string | null;
    };
}
export type ImpelEveChannel = Channel<ImpelEveChannelState, Record<string, never>, {
    orgId?: string;
    runId?: string;
    traceId?: string;
    repos?: string[];
    workspacePrepared: boolean;
}>;
export declare function defaultImpelEveChannel({ basicUser, basicPassword, includePlaceholderAuth, prepareAttachedRepos, checkoutDepth, }?: DefaultImpelEveChannelOptions): ImpelEveChannel;
export declare function createImpelEveChannelState(runContext: ImpelEveRunContext | null): ImpelEveChannelState;
export declare function extractImpelEveRunContextFromRequest(request: Request): Promise<ImpelEveRunContext | null>;
export declare function normalizeImpelEveRunContext(value: unknown): ImpelEveRunContext | null;
//# sourceMappingURL=channel.d.ts.map