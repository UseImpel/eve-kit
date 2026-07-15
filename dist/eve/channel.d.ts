import { type Channel } from "eve/channels";
import type { SandboxSession } from "eve/sandbox";
export interface DefaultImpelEveChannelOptions {
    basicUser?: string;
    basicPassword?: string;
    includePlaceholderAuth?: boolean;
    prepareAttachedRepos?: boolean;
    checkoutDepth?: number;
    trustedVercelSubjects?: readonly string[];
    /**
     * GitHub repositories (owner/repo) to broker *read-only* authenticated
     * network access to, even when the run has no attached workspace repos.
     *
     * The sandbox gets an installation token scoped to exactly these repos plus a
     * `gh` CLI auth marker, so tools can `gh api` / `git clone` them — but nothing
     * is checked out and general internet access is preserved. Use this to give an
     * agent authenticated read access to a private reference source it must
     * consult but should never modify (e.g. the eve-kit source for the Agent
     * Creator). Best-effort: if the token can't be minted the run continues with
     * default (open) networking and no GitHub auth.
     */
    referenceRepos?: readonly string[];
}
export interface ImpelEveRunContext {
    orgId?: string;
    repos?: string[];
    branch?: string;
    installationId?: string | number;
    githubConnectorUid?: string;
    runId?: string;
    traceId?: string;
    agent?: Record<string, unknown>;
    btParent?: string;
    codeIntelligence?: ImpelCodeIntelligenceContext;
    workspaceSeed?: {
        agentId: string;
        files: Array<{
            path: string;
            content: string;
            enc?: "utf8" | "base64";
        }>;
    };
}
export interface ImpelCodeIntelligenceRepository {
    provider: "github";
    providerRepoId: string;
    repoFullName: string;
    commitSha: string;
    requestedRef: string;
}
/** Exact-commit, non-secret workspace identity prepared by the Impel control plane. */
export interface ImpelCodeIntelligenceContext {
    workspaceId: string;
    expiresAt?: string;
    repositories: ImpelCodeIntelligenceRepository[];
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
    workspaceAuth: {
        identityRunToken?: string | null;
        /** @deprecated Read-only compatibility for serialized pre-v1 sessions. */
        runToken?: string | null;
    };
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
    referenceRepos?: readonly string[];
    getSandbox: () => Promise<SandboxSession>;
}
export type ImpelIdentityResolveErrorCode = "http_error" | "invalid_assertion" | "invalid_response" | "unreachable";
/** Safe, token-free failure from the centralized impel-identity resolver. */
export declare class ImpelIdentityResolveError extends Error {
    readonly code: ImpelIdentityResolveErrorCode;
    readonly status?: number;
    constructor(options: {
        code: ImpelIdentityResolveErrorCode;
        message: string;
        status?: number;
    });
}
export declare const IMPEL_IDENTITY_RUN_TOKEN_HEADER: "x-impel-identity-run-token";
export declare const IMPEL_IDENTITY_RUN_TOKEN_ATTRIBUTE: "impelIdentityRunToken";
export declare function defaultImpelEveChannel({ basicUser, basicPassword, includePlaceholderAuth, prepareAttachedRepos, checkoutDepth, trustedVercelSubjects, referenceRepos, }?: DefaultImpelEveChannelOptions): ImpelEveChannel;
export declare function createImpelEveChannelState(runContext: ImpelEveRunContext | null, workspaceAuth?: {
    identityRunToken?: string | null;
    /** @deprecated Accepted only for serialized pre-v1 state. */
    runToken?: string | null;
}): ImpelEveChannelState;
export declare function extractImpelEveRunContextFromRequest(request: Request): Promise<ImpelEveRunContext | null>;
export declare function readClientContextRunToken(value: unknown): string | null;
export declare function readClientContextIdentityRunToken(value: unknown): string | null;
export declare function normalizeImpelEveRunContext(value: unknown): ImpelEveRunContext | null;
export declare function normalizeClientContextMessages(value: unknown): string[] | undefined;
export declare function prepareImpelEveWorkspace(state: ImpelEveChannelState, options: PrepareImpelEveWorkspaceOptions): Promise<void>;
export declare function planImpelEveRepoCheckouts(repoNames: readonly string[]): ImpelPlannedRepoCheckout[];
/** Resolve the immutable checkout ref prepared by the control plane, if present. */
export declare function impelEveCheckoutRef(runContext: ImpelEveRunContext, repoFullName: string): string;
export declare function createImpelWorkspaceContextMessage(runContext: ImpelEveRunContext | null): string | undefined;
export declare function resolveVercelConnectGitHubConnectorUid(value?: string | undefined): string;
export declare function createVercelConnectGitHubTokenParams(runContext: ImpelEveRunContext, readOnly?: boolean): Record<string, unknown>;
//# sourceMappingURL=channel.d.ts.map