import { createSign } from "node:crypto";
import {
  defineChannel,
  GET,
  POST,
  type Channel,
  type HttpRouteDefinition,
  type RouteHandlerArgs,
  type SendOptions,
  type SendPayload,
} from "eve/channels";
import { eveChannel } from "eve/channels/eve";
import {
  httpBasic,
  localDev,
  placeholderAuth,
  routeAuth,
  vercelOidc,
  type AuthFn,
} from "eve/channels/auth";
import type { SandboxNetworkPolicy, SandboxSession } from "eve/sandbox";
import type { UserContent } from "ai";

export interface DefaultImpelEveChannelOptions {
  basicUser?: string;
  basicPassword?: string;
  includePlaceholderAuth?: boolean;
  prepareAttachedRepos?: boolean;
  checkoutDepth?: number;
  /**
   * Optional cone-mode sparse checkout paths keyed by attached GitHub
   * repository (`owner/repo`, matched case-insensitively).
   *
   * Each path is a conservative, repository-relative directory path such as
   * `wiki` or `docs/reference`. Configured repositories use Git partial fetch
   * (`--filter=blob:none`) and materialize only those directories (plus Git's
   * cone-mode parent/root files). Repositories not present in this map retain
   * the existing full-checkout behavior.
   *
   * Globs and shell syntax are intentionally not supported. Supplying an
   * absolute path, `.`/`..` segment, backslash, or shell metacharacter throws
   * while the channel is constructed.
   */
  attachedRepoSparsePaths?: Readonly<Record<string, readonly string[]>>;
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
  // Phase 2 [UNVERIFIED]: inline files the platform wants materialized into
  // `/workspace/agents/<agentId>/` at prep time. Used for the agent-creator
  // live-editor path, whose source of truth is the caller's UNCOMMITTED draft
  // (not in git, so `repos`/checkout can't serve it). Materialized only when no
  // `repos` are checked out. Keep bundles modest — this rides in the run
  // context; large payloads should move to a fetched reference in a follow-up.
  workspaceSeed?: {
    agentId: string;
    files: Array<{ path: string; content: string; enc?: "utf8" | "base64" }>;
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
  // Signed v1 server assertion from raw clientContext.identityRunToken,
  // carried OUTSIDE the typed run context so it can never reach channel
  // metadata() or workspace keys. Used only to authenticate workspace-prep
  // GitHub resolution against impel-identity (dark unless
  // IMPEL_IDENTITY_URL is set).
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

type ImpelEveChannelContext = {
  state: ImpelEveChannelState;
};

export type ImpelEveChannel = Channel<
  ImpelEveChannelState,
  Record<string, never>,
  ImpelEveChannelMetadata
>;

export type ImpelEveChannelMetadata = Record<string, unknown> &
  ImpelEveRunContext & {
    workspacePrepared: boolean;
  };

export interface PrepareImpelEveWorkspaceOptions {
  checkoutDepth?: number;
  attachedRepoSparsePaths?: Readonly<Record<string, readonly string[]>>;
  referenceRepos?: readonly string[];
  getSandbox: () => Promise<SandboxSession>;
}

export type ImpelIdentityResolveErrorCode =
  | "http_error"
  | "invalid_assertion"
  | "invalid_response"
  | "unreachable";

/** Safe, token-free failure from the centralized impel-identity resolver. */
export class ImpelIdentityResolveError extends Error {
  readonly code: ImpelIdentityResolveErrorCode;
  readonly status?: number;

  constructor(options: {
    code: ImpelIdentityResolveErrorCode;
    message: string;
    status?: number;
  }) {
    super(options.message);
    this.name = "ImpelIdentityResolveError";
    this.code = options.code;
    this.status = options.status;
  }
}

interface GitHubRepoRef {
  owner: string;
  repo: string;
  fullName: string;
}

interface WorkspaceRepoCheckout extends ImpelPlannedRepoCheckout {
  repoRef: GitHubRepoRef;
}

interface WorkspaceCheckoutPlan {
  layout: ImpelWorkspaceLayout;
  repos: WorkspaceRepoCheckout[];
}

interface GitHubInstallationToken {
  token: string;
  expiresAtMs: number;
}

type VercelConnectModule = {
  getTokenResponse: (
    connector: string,
    params: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
};

const DEFAULT_GITHUB_CONNECTOR_UID = "github/useimpel-github";
const EVE_SESSION_ID_HEADER = "x-eve-session-id";
const EVE_MESSAGE_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";
export const IMPEL_IDENTITY_RUN_TOKEN_HEADER =
  "x-impel-identity-run-token" as const;
export const IMPEL_IDENTITY_RUN_TOKEN_ATTRIBUTE =
  "impelIdentityRunToken" as const;

export function defaultImpelEveChannel({
  basicUser = process.env.EVE_APP_BASIC_USER ??
    process.env.IMPEL_EVE_BASIC_USER,
  basicPassword = process.env.EVE_APP_BASIC_PASSWORD ??
    process.env.IMPEL_EVE_BASIC_PASSWORD,
  includePlaceholderAuth = false,
  prepareAttachedRepos = true,
  checkoutDepth = readCheckoutDepthFromEnv(),
  attachedRepoSparsePaths,
  trustedVercelSubjects,
  referenceRepos,
}: DefaultImpelEveChannelOptions = {}): ImpelEveChannel {
  // Validate static channel configuration immediately, rather than failing a
  // user's first turn after the sandbox and GitHub token have been prepared.
  const normalizedAttachedRepoSparsePaths =
    normalizeAttachedRepoSparsePaths(attachedRepoSparsePaths);
  const basic =
    basicUser && basicPassword
      ? [httpBasic({ username: basicUser, password: basicPassword })]
      : [];

  const auth = [
    vercelOidc(
      trustedVercelSubjects?.length
        ? { subjects: trustedVercelSubjects }
        : undefined,
    ),
    localDev(),
    ...basic,
    ...(includePlaceholderAuth ? [placeholderAuth()] : []),
  ].map(withImpelIdentityRunToken);

  return defineChannel<
    ImpelEveChannelState,
    ImpelEveChannelContext,
    Record<string, never>,
    {
      orgId?: string;
      runId?: string;
      traceId?: string;
      repos?: string[];
      codeIntelligence?: ImpelCodeIntelligenceContext;
      workspacePrepared: boolean;
    }
  >({
    state: createImpelEveChannelState(null),
    context(state) {
      return { state };
    },
    metadata(state) {
      return {
        ...(state.runContext ?? {}),
        workspacePrepared: state.workspace.prepared,
        // Surface checkout failures to the MODEL: eve's adapter wrapper
        // swallows the turn.started throw, so without this the agent sees an
        // empty /workspace with no explanation and mis-reports the repo as
        // empty/missing instead of naming the real credential/config failure.
        ...(state.workspace.error
          ? { workspaceError: state.workspace.error }
          : {}),
      };
    },
    routes: createImpelEveRoutes(auth),
    events: {
      async "turn.started"(_event, channel, ctx) {
        if (!prepareAttachedRepos) return;
        await prepareImpelEveWorkspace(channel.state, {
          checkoutDepth,
          attachedRepoSparsePaths: normalizedAttachedRepoSparsePaths,
          referenceRepos,
          getSandbox: () => ctx.getSandbox(),
        });
      },
    },
  });
}

function withImpelIdentityRunToken(authenticate: AuthFn<Request>): AuthFn<Request> {
  return async (request) => {
    const authorized = await authenticate(request);
    if (!authorized) return authorized;

    const token = canonicalIdentityRunToken(
      request.headers.get(IMPEL_IDENTITY_RUN_TOKEN_HEADER),
    );
    return attachImpelIdentityRunToken(authorized, token);
  };
}

type ImpelSessionAuthContext = NonNullable<
  Awaited<ReturnType<AuthFn<Request>>>
>;

function attachImpelIdentityRunToken(
  authorized: ImpelSessionAuthContext,
  value: string | null,
): ImpelSessionAuthContext {
  const existing = canonicalIdentityRunToken(
    typeof authorized.attributes[IMPEL_IDENTITY_RUN_TOKEN_ATTRIBUTE] ===
      "string"
      ? authorized.attributes[IMPEL_IDENTITY_RUN_TOKEN_ATTRIBUTE]
      : null,
  );
  const token = existing ?? canonicalIdentityRunToken(value);
  if (!token) return authorized;
  return {
    ...authorized,
    attributes: {
      ...authorized.attributes,
      [IMPEL_IDENTITY_RUN_TOKEN_ATTRIBUTE]: token,
    },
  };
}

function canonicalIdentityRunToken(value: string | null): string | null {
  const token = value?.trim();
  if (
    !token ||
    Buffer.byteLength(token, "utf8") > 8 * 1024 ||
    !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  ) {
    return null;
  }
  return token;
}

export function createImpelEveChannelState(
  runContext: ImpelEveRunContext | null,
  workspaceAuth?: {
    identityRunToken?: string | null;
    /** @deprecated Accepted only for serialized pre-v1 state. */
    runToken?: string | null;
  },
): ImpelEveChannelState {
  return {
    runContext,
    workspaceAuth: {
      identityRunToken: readWorkspaceIdentityRunToken(workspaceAuth),
    },
    workspace: {
      prepared: false,
      sandboxId: null,
      key: null,
      layout: null,
      repos: [],
      error: null,
    },
  };
}

export async function extractImpelEveRunContextFromRequest(
  request: Request,
): Promise<ImpelEveRunContext | null> {
  if (request.method !== "POST") return null;

  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return null;
  }

  if (!isRecord(body)) return null;
  return normalizeImpelEveRunContext(body.clientContext);
}

// Reads the gateway token without ever treating it as an identity assertion.
export function readClientContextRunToken(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return typeof value.runToken === "string" && value.runToken.length > 0
    ? value.runToken
    : null;
}

// Reads the dedicated v1 server assertion for workspace identity resolution.
// Older callers may reuse runToken only when it is itself v1 and the dedicated
// field is absent. A gateway-audience v2 token is never sent to identity.
export function readClientContextIdentityRunToken(
  value: unknown,
): string | null {
  if (!isRecord(value)) return null;
  if (Object.prototype.hasOwnProperty.call(value, "identityRunToken")) {
    return readString(value.identityRunToken) ?? null;
  }
  return readV1RunToken(value.runToken);
}

function readWorkspaceIdentityRunToken(
  value:
    | {
        identityRunToken?: string | null;
        runToken?: string | null;
      }
    | undefined,
): string | null {
  if (!value) return null;
  if (Object.prototype.hasOwnProperty.call(value, "identityRunToken")) {
    return readString(value.identityRunToken) ?? null;
  }
  return readV1RunToken(value.runToken);
}

// clientContext.runToken and identityRunToken are deliberately NOT part of the
// typed channel context: the raw clientContext sentinel
// (normalizeClientContextMessages) is the sole carrier to the gateway wrapper,
// keeping both credentials out of channel metadata() and workspace keys.
export function normalizeImpelEveRunContext(
  value: unknown,
): ImpelEveRunContext | null {
  if (!isRecord(value)) return null;

  const repos = Array.isArray(value.repos)
    ? value.repos
        .filter((repo): repo is string => typeof repo === "string")
        .map((repo) => repo.trim())
        .filter(Boolean)
    : undefined;

  return stripUndefined({
    orgId: readString(value.orgId),
    repos: repos && repos.length > 0 ? Array.from(new Set(repos)) : undefined,
    branch: readString(value.branch),
    installationId:
      typeof value.installationId === "string" ||
      typeof value.installationId === "number"
        ? value.installationId
        : undefined,
    githubConnectorUid: readString(value.githubConnectorUid),
    runId: readString(value.runId),
    traceId: readString(value.traceId),
    agent: isRecord(value.agent) ? value.agent : undefined,
    btParent: readString(value.btParent),
    codeIntelligence: parseCodeIntelligenceContext(value.codeIntelligence),
    workspaceSeed: parseWorkspaceSeed(value.workspaceSeed),
  });
}

function parseCodeIntelligenceContext(
  value: unknown,
): ImpelCodeIntelligenceContext | undefined {
  if (!isRecord(value)) return undefined;
  const workspaceId = readString(value.workspaceId);
  if (!workspaceId || !Array.isArray(value.repositories)) return undefined;
  const repositories = value.repositories
    .map((repository): ImpelCodeIntelligenceRepository | undefined => {
      if (!isRecord(repository)) return undefined;
      const providerRepoId = readString(repository.providerRepoId);
      const repoFullName = readString(repository.repoFullName);
      const commitSha = readString(repository.commitSha)?.toLowerCase();
      const requestedRef = readString(repository.requestedRef);
      if (
        repository.provider !== "github" ||
        !providerRepoId ||
        !repoFullName ||
        !commitSha ||
        !/^[a-f0-9]{40,64}$/.test(commitSha) ||
        !requestedRef
      ) {
        return undefined;
      }
      return {
        provider: "github",
        providerRepoId,
        repoFullName,
        commitSha,
        requestedRef,
      };
    })
    .filter(
      (repository): repository is ImpelCodeIntelligenceRepository =>
        repository !== undefined,
    );
  if (repositories.length === 0) return undefined;
  return {
    workspaceId,
    ...(readString(value.expiresAt)
      ? { expiresAt: readString(value.expiresAt) }
      : {}),
    repositories,
  };
}

// Defensive parse of the Phase 2 inline workspace seed. Returns undefined unless
// it carries a non-empty agentId and at least one { path, content } file.
function parseWorkspaceSeed(
  value: unknown,
): ImpelEveRunContext["workspaceSeed"] {
  if (!isRecord(value)) return undefined;
  const agentId = readString(value.agentId);
  if (!agentId || !Array.isArray(value.files)) return undefined;
  const files: NonNullable<ImpelEveRunContext["workspaceSeed"]>["files"] = [];
  for (const entry of value.files) {
    if (!isRecord(entry)) continue;
    const path = readString(entry.path);
    if (!path || typeof entry.content !== "string") continue;
    const enc = entry.enc === "base64" ? "base64" : "utf8";
    files.push({ path, content: entry.content, enc });
  }
  return files.length > 0 ? { agentId, files } : undefined;
}

export function normalizeClientContextMessages(
  value: unknown,
): string[] | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") {
    return value.length > 0 ? [toClientContextMessage(value)] : undefined;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    if (!value.every((item) => typeof item === "string" && item.length > 0)) {
      throw new Error(
        "Expected 'clientContext' array entries to be non-empty strings.",
      );
    }
    return value.map((item) => toClientContextMessage(item));
  }
  if (!isRecord(value)) {
    throw new Error(
      "Expected 'clientContext' to be a string, string array, or JSON object.",
    );
  }
  return [
    toClientContextMessage(JSON.stringify(assertJsonSerializable(value))),
  ];
}

function toClientContextMessage(value: string): string {
  return `Client context:\n${value}`;
}

export async function prepareImpelEveWorkspace(
  state: ImpelEveChannelState,
  options: PrepareImpelEveWorkspaceOptions,
): Promise<void> {
  const runContext = state.runContext;
  if (!runContext?.repos?.length) {
    // No workspace repos to check out. If reference repos are configured, still
    // broker read-only authenticated GitHub access (network policy + gh CLI
    // marker) so tools can `gh api` / `git clone` them — without any checkout.
    const referenceRepos = normalizeReferenceRepos(options.referenceRepos);
    if (runContext && referenceRepos.length) {
      await prepareReferenceRepoAccess(state, runContext, referenceRepos, options);
    }
    // Phase 2 [UNVERIFIED]: materialize an inline draft bundle into /workspace
    // (the live-editor path, whose source is the caller's uncommitted draft — no
    // repo to check out). Best-effort: a failure leaves an empty workspace and
    // the model falls back to the prompt snapshot, exactly as today.
    if (runContext?.workspaceSeed?.files.length) {
      try {
        await materializeWorkspaceSeed(
          await options.getSandbox(),
          runContext.workspaceSeed,
        );
      } catch {
        // best-effort — model falls back to the snapshot.
      }
    }
    return;
  }

  const sandbox = await options.getSandbox();
  const checkoutPlan = createWorkspaceCheckoutPlan(runContext.repos);
  const checkoutDepth = options.checkoutDepth ?? readCheckoutDepthFromEnv();
  const attachedRepoSparsePaths = normalizeAttachedRepoSparsePaths(
    options.attachedRepoSparsePaths,
  );
  const workspaceKey = createWorkspaceKey(runContext, {
    checkoutDepth,
    layout: checkoutPlan.layout,
    repos: checkoutPlan.repos,
    attachedRepoSparsePaths,
  });
  if (
    state.workspace.prepared &&
    state.workspace.sandboxId === sandbox.id &&
    state.workspace.key === workspaceKey
  ) {
    return;
  }

  try {
    const token = await resolveGitHubAccessToken(runContext, {
      identityRunToken: readWorkspaceIdentityRunToken(state.workspaceAuth),
    });
    await sandbox.setNetworkPolicy(buildGitHubBrokerNetworkPolicy(token));
    await configureGitHubCliAuthMarker(sandbox);
    await prepareWorkspaceRoot(sandbox, checkoutPlan.layout);

    // Write the run-context marker BEFORE cloning so a co-resident subagent
    // that runs while this checkout is still in flight can already recover the
    // repos and prepare its own view. Overwritten with the checked-out shas by
    // writeWorkspaceMetadata below.
    await writeRunContextMarker(sandbox, runContext, checkoutPlan);

    const prepared: ImpelPreparedRepo[] = [];
    for (const planned of checkoutPlan.repos) {
      const checkout = await checkoutGitHubRepository(
        sandbox,
        planned.repoRef,
        {
          depth: checkoutDepth,
          path: planned.path,
          ref: impelEveCheckoutRef(runContext, planned.repo),
          sparsePaths:
            attachedRepoSparsePaths[planned.repo.toLowerCase()],
        },
      );
      prepared.push(checkout);
    }

    await writeWorkspaceMetadata(
      sandbox,
      runContext,
      prepared,
      checkoutPlan.layout,
    );
    state.workspace = {
      prepared: true,
      sandboxId: sandbox.id,
      key: workspaceKey,
      layout: checkoutPlan.layout,
      repos: prepared,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.workspace = {
      prepared: false,
      sandboxId: sandbox.id,
      key: null,
      layout: null,
      repos: [],
      error: message,
    };
    // Leave a marker where the agent will look: eve's adapter swallows this
    // throw, so an unexplained empty /workspace is all the model would see.
    await writeCheckoutFailureMarker(sandbox, message).catch(() => {});
    throw error;
  }
}

// Phase 2 [UNVERIFIED]: write inline seed files into /workspace/agents/<id>/ so
// the model reads the real, UNTRUNCATED draft bundle. Path traversal is stripped
// so a seed can only ever land under the agent root. Content rides the shell as
// base64 (utf8 seeds are re-encoded) so any bytes survive.
async function materializeWorkspaceSeed(
  sandbox: { run(input: { command: string }): PromiseLike<unknown> },
  seed: NonNullable<ImpelEveRunContext["workspaceSeed"]>,
): Promise<void> {
  const root = `/workspace/agents/${safeSeedSegment(seed.agentId)}`;
  await sandbox.run({ command: `mkdir -p '${root}'` });
  for (const file of seed.files) {
    const rel = normalizeSeedPath(file.path);
    if (!rel) continue;
    const abs = `${root}/${rel}`;
    const dir = abs.slice(0, abs.lastIndexOf("/"));
    const b64 =
      file.enc === "base64"
        ? file.content.replace(/[^A-Za-z0-9+/=]/g, "")
        : Buffer.from(file.content, "utf8").toString("base64");
    await sandbox.run({
      command: `mkdir -p '${dir}' && printf '%s' '${b64}' | base64 -d > '${abs}'`,
    });
  }
}

function safeSeedSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "-") || "agent";
}

// Strip leading slashes, `.` and `..` so a seed path only lands under the root.
function normalizeSeedPath(path: string): string | null {
  const parts = path
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..");
  return parts.length ? parts.join("/") : null;
}

/** Best-effort `/workspace/CHECKOUT_FAILED.md` so `ls /workspace` tells the
 * story even when the failure event itself never reaches the run. */
async function writeCheckoutFailureMarker(
  sandbox: { run(input: { command: string }): PromiseLike<unknown> },
  message: string,
): Promise<void> {
  const body = [
    "# Repository checkout FAILED",
    "",
    "The platform attached repositories to this run, but checking them out",
    "failed — this workspace is NOT a faithful copy of the repository.",
    "Report this error to the user verbatim instead of treating the",
    "repository as empty:",
    "",
    "```",
    message.replaceAll("`", "'"),
    "```",
  ].join("\n");
  const encoded = Buffer.from(body, "utf8").toString("base64");
  await sandbox.run({
    command: `mkdir -p /workspace && printf '%s' '${encoded}' | base64 -d > /workspace/CHECKOUT_FAILED.md`,
  });
}

function normalizeReferenceRepos(
  referenceRepos: readonly string[] | undefined,
): string[] {
  const names = new Set<string>();
  for (const entry of referenceRepos ?? []) {
    const trimmed = entry.trim();
    if (trimmed) names.add(trimmed);
  }
  return Array.from(names);
}

function normalizeAttachedRepoSparsePaths(
  value:
    | Readonly<Record<string, readonly string[]>>
    | undefined,
): Readonly<Record<string, readonly string[]>> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new Error(
      "attachedRepoSparsePaths must be an object keyed by GitHub owner/repo.",
    );
  }

  const normalized: Record<string, readonly string[]> = {};
  for (const [configuredRepo, configuredPaths] of Object.entries(value)) {
    const repoName = configuredRepo.trim();
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoName)) {
      throw new Error(
        `Invalid sparse checkout repository "${configuredRepo}". Expected owner/repo.`,
      );
    }
    if (!Array.isArray(configuredPaths) || configuredPaths.length === 0) {
      throw new Error(
        `Sparse checkout for ${repoName} requires at least one path.`,
      );
    }
    if (configuredPaths.length > 128) {
      throw new Error(
        `Sparse checkout for ${repoName} exceeds the 128-path limit.`,
      );
    }

    const paths = new Set<string>();
    for (const configuredPath of configuredPaths) {
      if (typeof configuredPath !== "string") {
        throw new Error(
          `Invalid sparse checkout path for ${repoName}. Expected a string.`,
        );
      }
      const path = configuredPath.trim();
      const segments = path.split("/");
      if (
        path.length === 0 ||
        path.length > 512 ||
        path.startsWith("/") ||
        path.includes("\\") ||
        !/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(path) ||
        segments.some(
          (segment) =>
            segment === "." ||
            segment === ".." ||
            segment.toLowerCase() === ".git",
        )
      ) {
        throw new Error(
          `Invalid sparse checkout path "${configuredPath}" for ${repoName}. ` +
            "Use repository-relative directory paths without '.', '..', globs, backslashes, or shell syntax.",
        );
      }
      paths.add(path);
    }

    const key = repoName.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      throw new Error(
        `Sparse checkout repository ${repoName} is configured more than once.`,
      );
    }
    normalized[key] = Array.from(paths);
  }
  return normalized;
}

/**
 * Broker read-only, authenticated GitHub access to a fixed set of reference
 * repositories without checking anything out. Sets a network policy that injects
 * an installation token (scoped to exactly those repos) on github.com requests
 * while leaving all other hosts open, plus a `gh` CLI auth marker.
 *
 * Best-effort: any failure (missing app env, repo not in installation, etc.)
 * is swallowed so it never fails the run — the sandbox simply keeps its default
 * open networking and the agent falls back to whatever bundled docs it has.
 */
async function prepareReferenceRepoAccess(
  state: ImpelEveChannelState,
  runContext: ImpelEveRunContext,
  referenceRepos: string[],
  options: PrepareImpelEveWorkspaceOptions,
): Promise<void> {
  const sandbox = await options.getSandbox();
  const workspaceKey = `reference:${referenceRepos.slice().sort().join(",")}`;
  if (
    state.workspace.prepared &&
    state.workspace.sandboxId === sandbox.id &&
    state.workspace.key === workspaceKey
  ) {
    return;
  }

  try {
    // Scope the brokered token to the reference repos only (least privilege).
    const referenceRunContext: ImpelEveRunContext = {
      ...runContext,
      repos: referenceRepos,
    };
    const token = await resolveGitHubAccessToken(referenceRunContext, {
      scopeRepositories: githubRepositoryNamesFromRunContext(referenceRunContext),
      readOnly: true,
      identityRunToken: readWorkspaceIdentityRunToken(state.workspaceAuth),
    });
    await sandbox.setNetworkPolicy(buildGitHubBrokerNetworkPolicy(token));
    await configureGitHubCliAuthMarker(sandbox);
    state.workspace = {
      prepared: true,
      sandboxId: sandbox.id,
      key: workspaceKey,
      layout: null,
      repos: [],
      error: null,
    };
  } catch (error) {
    // Reference read access is best-effort and must never fail the run. Leave
    // the default (open) network policy in place so general internet access and
    // the agent's own tools keep working.
    const message = error instanceof Error ? error.message : String(error);
    state.workspace = {
      prepared: false,
      sandboxId: sandbox.id,
      key: null,
      layout: null,
      repos: [],
      error: message,
    };
  }
}

function createImpelEveRoutes(auth: readonly AuthFn<Request>[]) {
  return [
    createImpelEveInfoRoute(auth),
    POST<ImpelEveChannelState>("/eve/v1/session", async (request, args) => {
      const authorized = await routeAuth(request, auth);
      if (authorized instanceof Response) return authorized;

      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;

      const parsed = parseCreateSessionBody(body);
      if (parsed instanceof Response) return parsed;

      const sessionAuth = attachImpelIdentityRunToken(
        authorized,
        readClientContextIdentityRunToken(parsed.clientContext),
      );

      const state = createImpelEveChannelState(
        normalizeImpelEveRunContext(parsed.clientContext),
        {
          identityRunToken: readClientContextIdentityRunToken(
            parsed.clientContext,
          ),
        },
      );
      const session = await args.send(
        createSendPayload(parsed),
        withState(
          {
            auth: sessionAuth,
            continuationToken: `eve:${crypto.randomUUID()}`,
            mode: parsed.mode,
          },
          state,
        ),
      );

      return Response.json(
        {
          continuationToken: session.continuationToken,
          ok: true,
          sessionId: session.id,
        },
        {
          headers: {
            "cache-control": "no-store",
            [EVE_SESSION_ID_HEADER]: session.id,
          },
          status: 202,
        },
      );
    }),
    POST<ImpelEveChannelState>(
      "/eve/v1/session/:sessionId",
      async (request, args) => {
        const authorized = await routeAuth(request, auth);
        if (authorized instanceof Response) return authorized;

        const sessionId = args.params.sessionId;
        if (!sessionId) {
          return jsonError("Missing session id.", 400);
        }
        try {
          args.getSession(sessionId);
        } catch {
          return jsonError("Session not found.", 404);
        }

        const body = await parseJsonBody(request);
        if (body instanceof Response) return body;

        const parsed = parseContinueSessionBody(body);
        if (parsed instanceof Response) return parsed;

        const sessionAuth = attachImpelIdentityRunToken(
          authorized,
          readClientContextIdentityRunToken(parsed.clientContext),
        );

        const state = createImpelEveChannelState(
          normalizeImpelEveRunContext(parsed.clientContext),
          {
            identityRunToken: readClientContextIdentityRunToken(
              parsed.clientContext,
            ),
          },
        );
        const session = await args.send(
          createSendPayload(parsed),
          withState(
            {
              auth: sessionAuth,
              continuationToken: parsed.continuationToken,
            },
            state,
          ),
        );

        return Response.json(
          {
            ok: true,
            sessionId: session.id,
          },
          {
            headers: {
              "cache-control": "no-store",
              [EVE_SESSION_ID_HEADER]: session.id,
            },
            status: 200,
          },
        );
      },
    ),
    GET<ImpelEveChannelState>(
      "/eve/v1/session/:sessionId/stream",
      async (request, args) => {
        const authorized = await routeAuth(request, auth);
        if (authorized instanceof Response) return authorized;

        const sessionId = args.params.sessionId;
        if (!sessionId) {
          return jsonError("Missing session id.", 400);
        }

        const startIndex = parseStartIndex(request);
        if (startIndex instanceof Response) return startIndex;

        try {
          const stream = await args
            .getSession(sessionId)
            .getEventStream({ startIndex });
          return new Response(serializeAsNdjson(stream), {
            headers: {
              "cache-control": "no-store, no-transform",
              "content-type": EVE_MESSAGE_STREAM_CONTENT_TYPE,
              "x-accel-buffering": "no",
              [EVE_SESSION_ID_HEADER]: sessionId,
            },
          });
        } catch {
          return jsonError("Session not found.", 404);
        }
      },
    ),
  ];
}

function createImpelEveInfoRoute(
  auth: readonly AuthFn<Request>[],
): HttpRouteDefinition<ImpelEveChannelState> {
  const route = eveChannel({ auth }).routes.find(
    (candidate) =>
      candidate.method === "GET" && candidate.path === "/eve/v1/info",
  );
  if (!route || route.transport === "websocket") {
    throw new Error("Eve's standard agent info route is unavailable.");
  }

  // Reuse Eve's own authenticated info handler so its internal Nitro dispatch
  // context and response schema stay version-aligned. The handler never sends
  // a session, so adapting its stateless RouteHandlerArgs to this stateful
  // channel is safe; the original runtime args object is passed through.
  return GET<ImpelEveChannelState>("/eve/v1/info", (request, args) =>
    route.handler(
      request,
      args as unknown as RouteHandlerArgs,
    ),
  );
}

type CreateSessionBody = {
  message: string | UserContent;
  clientContext?: unknown;
  context?: readonly string[];
  mode?: "conversation" | "task";
  outputSchema?: Record<string, unknown>;
};

type ContinueSessionBody = {
  continuationToken: string;
  message?: string | UserContent;
  inputResponses?: readonly unknown[];
  clientContext?: unknown;
  context?: readonly string[];
  outputSchema?: Record<string, unknown>;
};

async function parseJsonBody(
  request: Request,
): Promise<Record<string, unknown> | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }
  if (!isRecord(body)) return jsonError("Expected a JSON object.", 400);
  return body;
}

function parseCreateSessionBody(
  body: Record<string, unknown>,
): CreateSessionBody | Response {
  const message = parseMessageField(body.message);
  if (message instanceof Response) return message;
  if (message === undefined) {
    return jsonError("Missing or empty 'message' field.", 400);
  }

  const context = parseClientContextField(body.clientContext);
  if (context instanceof Response) return context;

  const mode = parseModeField(body.mode);
  if (mode instanceof Response) return mode;

  const outputSchema = parseOutputSchemaField(body.outputSchema);
  if (outputSchema instanceof Response) return outputSchema;

  return stripUndefined({
    clientContext: body.clientContext,
    context,
    message,
    mode,
    outputSchema,
  });
}

function parseContinueSessionBody(
  body: Record<string, unknown>,
): ContinueSessionBody | Response {
  const continuationToken =
    typeof body.continuationToken === "string" &&
    body.continuationToken.length > 0
      ? body.continuationToken
      : undefined;
  if (!continuationToken) {
    return jsonError("Missing or empty 'continuationToken' field.", 400);
  }

  const message = parseMessageField(body.message);
  if (message instanceof Response) return message;

  const inputResponses = parseInputResponsesField(body.inputResponses);
  if (inputResponses instanceof Response) return inputResponses;

  if (message === undefined && inputResponses === undefined) {
    return jsonError(
      "Expected a non-empty 'message', a non-empty 'inputResponses' array, or both.",
      400,
    );
  }

  const context = parseClientContextField(body.clientContext);
  if (context instanceof Response) return context;

  const outputSchema = parseOutputSchemaField(body.outputSchema);
  if (outputSchema instanceof Response) return outputSchema;

  return stripUndefined({
    clientContext: body.clientContext,
    context,
    continuationToken,
    inputResponses,
    message,
    outputSchema,
  });
}

function parseMessageField(
  value: unknown,
): string | UserContent | undefined | Response {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value.length > 0 ? value : undefined;
  if (!Array.isArray(value)) {
    return jsonError(
      "Expected 'message' to be a string or an array of text/file parts.",
      400,
    );
  }
  if (value.length === 0) return undefined;
  return value as UserContent;
}

function parseClientContextField(
  value: unknown,
): string[] | undefined | Response {
  try {
    return withWorkspaceContextMessages(
      value,
      normalizeClientContextMessages(value),
    );
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : String(error),
      400,
    );
  }
}

function withWorkspaceContextMessages(
  clientContext: unknown,
  messages: string[] | undefined,
): string[] | undefined {
  const workspaceContext = createImpelWorkspaceContextMessage(
    normalizeImpelEveRunContextFromClientContext(clientContext),
  );
  if (!workspaceContext) return messages;
  return [...(messages ?? []), workspaceContext];
}

function normalizeImpelEveRunContextFromClientContext(
  value: unknown,
): ImpelEveRunContext | null {
  const direct = normalizeImpelEveRunContext(value);
  if (direct) return direct;
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return normalizeImpelEveRunContext(JSON.parse(value));
  } catch {
    return null;
  }
}

function parseInputResponsesField(
  value: unknown,
): readonly unknown[] | undefined | Response {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    return jsonError("Expected 'inputResponses' to be a non-empty array.", 400);
  }
  return value;
}

function parseModeField(
  value: unknown,
): "conversation" | "task" | undefined | Response {
  if (value === undefined) return undefined;
  if (value === "conversation" || value === "task") return value;
  return jsonError(
    "Expected 'mode' to be either 'conversation' or 'task'.",
    400,
  );
}

function parseOutputSchemaField(
  value: unknown,
): Record<string, unknown> | undefined | Response {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    return jsonError("Expected 'outputSchema' to be a JSON object.", 400);
  }
  try {
    return assertJsonSerializable(value);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : String(error),
      400,
    );
  }
}

function createSendPayload(input: {
  message?: string | UserContent;
  inputResponses?: readonly unknown[];
  context?: readonly string[];
  outputSchema?: Record<string, unknown>;
}): string | UserContent | SendPayload {
  if (
    input.message !== undefined &&
    input.context === undefined &&
    input.outputSchema === undefined &&
    input.inputResponses === undefined
  ) {
    return input.message;
  }

  return stripUndefined({
    context: input.context,
    inputResponses: input.inputResponses,
    message: input.message,
    outputSchema: input.outputSchema,
  }) as SendPayload;
}

function withState(
  options: Omit<SendOptions<ImpelEveChannelState>, "state">,
  state: ImpelEveChannelState,
): SendOptions<ImpelEveChannelState> {
  return {
    ...options,
    state,
  };
}

function parseStartIndex(request: Request): number | undefined | Response {
  const value = new URL(request.url).searchParams.get("startIndex");
  if (value === null) return undefined;
  const startIndex = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(startIndex) || startIndex < 0) {
    return jsonError("Expected startIndex to be a non-negative integer.", 400);
  }
  return startIndex;
}

function serializeAsNdjson(
  stream: ReadableStream<unknown>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return stream.pipeThrough(
    new TransformStream({
      transform(event, controller) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      },
    }),
  );
}

function jsonError(error: string, status: number): Response {
  return Response.json(
    {
      error,
      ok: false,
    },
    { status },
  );
}

function assertJsonSerializable(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export function planImpelEveRepoCheckouts(
  repoNames: readonly string[],
): ImpelPlannedRepoCheckout[] {
  return createWorkspaceCheckoutPlan(repoNames).repos.map((repo) => ({
    repo: repo.repo,
    path: repo.path,
    role: repo.role,
  }));
}

/** Resolve the immutable checkout ref prepared by the control plane, if present. */
export function impelEveCheckoutRef(
  runContext: ImpelEveRunContext,
  repoFullName: string,
): string {
  const normalized = repoFullName.toLowerCase();
  const exact = runContext.codeIntelligence?.repositories.find(
    (repository) => repository.repoFullName.toLowerCase() === normalized,
  );
  return exact?.commitSha ?? runContext.branch ?? "HEAD";
}

export function createImpelWorkspaceContextMessage(
  runContext: ImpelEveRunContext | null,
): string | undefined {
  if (!runContext?.repos?.length) return undefined;
  const plan = createWorkspaceCheckoutPlan(runContext.repos);
  const lines = [
    "Impel workspace context:",
    `- Layout: ${plan.layout}`,
    "- The Eve sandbox command working directory is /workspace.",
  ];

  if (plan.layout === "multi-repo-directory") {
    lines.push(
      "- /workspace is a coordination directory, not a git checkout.",
      "- The attached repositories are already cloned at these paths:",
    );
  } else {
    lines.push("- The attached repository is already cloned at this path:");
  }

  for (const repo of plan.repos) {
    lines.push(`  - ${repo.repo}: ${repo.path}`);
  }

  lines.push(
    "- Use git commands against the listed paths, for example: git -C <path> rev-list --count HEAD.",
    "- Do not ask the user for repo paths or GitHub tokens before checking these workspace paths.",
    "- Workspace metadata is also available at /workspace/.impel/run-context.json and /workspace/README_IMPEL_WORKSPACE.md.",
  );

  return lines.join("\n");
}

function createWorkspaceCheckoutPlan(
  repoNames: readonly string[],
): WorkspaceCheckoutPlan {
  const repoRefs = repoNames.map(parseGitHubRepo);
  const layout: ImpelWorkspaceLayout =
    repoRefs.length <= 1 ? "single-repo-root" : "multi-repo-directory";
  const repoNameCounts = countRepoNames(repoRefs);

  return {
    layout,
    repos: repoRefs.map((repoRef, index) => ({
      repo: repoRef.fullName,
      repoRef,
      path:
        layout === "single-repo-root"
          ? "/workspace"
          : `/workspace/${checkoutDirectoryName(repoRef, repoNameCounts)}`,
      role: index === 0 ? "primary" : "additional",
    })),
  };
}

function countRepoNames(
  repoRefs: readonly GitHubRepoRef[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const repo of repoRefs) {
    counts.set(repo.repo, (counts.get(repo.repo) ?? 0) + 1);
  }
  return counts;
}

function checkoutDirectoryName(
  repo: GitHubRepoRef,
  repoNameCounts: ReadonlyMap<string, number>,
): string {
  if ((repoNameCounts.get(repo.repo) ?? 0) === 1) {
    return safePathSegment(repo.repo);
  }
  return safePathSegment(repo.fullName);
}

function createWorkspaceKey(
  runContext: ImpelEveRunContext,
  plan: {
    checkoutDepth: number;
    layout: ImpelWorkspaceLayout;
    repos: readonly WorkspaceRepoCheckout[];
    attachedRepoSparsePaths: Readonly<Record<string, readonly string[]>>;
  },
): string {
  return JSON.stringify({
    branch: runContext.branch ?? "HEAD",
    checkoutDepth: plan.checkoutDepth,
    layout: plan.layout,
    repos: plan.repos.map((repo) => ({
      path: repo.path,
      repo: repo.repo,
      ref: impelEveCheckoutRef(runContext, repo.repo),
      sparsePaths: plan.attachedRepoSparsePaths[repo.repo.toLowerCase()],
    })),
  });
}

async function prepareWorkspaceRoot(
  sandbox: SandboxSession,
  layout: ImpelWorkspaceLayout,
): Promise<void> {
  if (layout === "single-repo-root") {
    await runSandboxCommand(
      sandbox,
      "prepare single-repo workspace root",
      "mkdir -p /workspace",
    );
    return;
  }

  await runSandboxCommand(
    sandbox,
    "prepare multi-repo workspace root",
    [
      "mkdir -p /workspace",
      "find /workspace -mindepth 1 -maxdepth 1 ! -name skills -exec rm -rf {} +",
      "mkdir -p /workspace/.impel",
    ].join("\n"),
  );
}

async function checkoutGitHubRepository(
  sandbox: SandboxSession,
  repo: GitHubRepoRef,
  options: {
    depth: number;
    path: string;
    ref: string;
    sparsePaths?: readonly string[];
  },
): Promise<ImpelPreparedRepo> {
  const path = sandbox.resolvePath(options.path);
  const ref = options.ref;
  const depthFlag =
    Number.isFinite(options.depth) && options.depth > 0
      ? ` --depth ${Math.floor(options.depth)}`
      : "";
  const remote = `https://github.com/${repo.owner}/${repo.repo}.git`;

  await runSandboxCommand(
    sandbox,
    "create checkout directory",
    `mkdir -p ${shellQuote(path)}`,
  );
  await runSandboxCommand(
    sandbox,
    "configure git safe directory",
    `git config --global --add safe.directory ${shellQuote(path)} || true`,
  );
  await runSandboxCommand(
    sandbox,
    "initialize git repository",
    `cd ${shellQuote(path)} && git init`,
  );
  if (!options.sparsePaths) {
    await runSandboxCommand(
      sandbox,
      "disable sparse checkout for full workspace",
      [
        `cd ${shellQuote(path)}`,
        "if git sparse-checkout list >/dev/null 2>&1; then",
        "  git sparse-checkout disable",
        "fi",
      ].join("\n"),
    );
  }
  await runSandboxCommand(
    sandbox,
    "reset git remote",
    `cd ${shellQuote(path)} && git remote remove origin >/dev/null 2>&1 || true`,
  );
  await runSandboxCommand(
    sandbox,
    "configure git remote",
    `cd ${shellQuote(path)} && git remote add origin ${shellQuote(remote)}`,
  );
  if (options.sparsePaths) {
    await runSandboxCommand(
      sandbox,
      "initialize sparse checkout",
      `cd ${shellQuote(path)} && git sparse-checkout init --cone`,
    );
    await runSandboxCommand(
      sandbox,
      "configure sparse checkout paths",
      [
        `cd ${shellQuote(path)} && printf '%s\\n'`,
        ...options.sparsePaths.map(shellQuote),
        "| git sparse-checkout set --cone --stdin",
      ].join(" "),
    );
  }
  await runSandboxCommand(
    sandbox,
    "fetch GitHub ref",
    `cd ${shellQuote(path)} && GIT_TERMINAL_PROMPT=0 git fetch${depthFlag}${options.sparsePaths ? " --filter=blob:none" : ""} origin ${shellQuote(ref)}`,
  );
  await runSandboxCommand(
    sandbox,
    "checkout GitHub ref",
    `cd ${shellQuote(path)} && git checkout --detach -f FETCH_HEAD`,
  );

  const head = await runSandboxCommand(
    sandbox,
    "resolve checked out commit",
    `cd ${shellQuote(path)} && git rev-parse HEAD`,
  );

  return {
    repo: repo.fullName,
    path,
    ref,
    sha: String(head.stdout ?? "").trim(),
  };
}

async function configureGitHubCliAuthMarker(
  sandbox: SandboxSession,
): Promise<void> {
  await runSandboxCommand(
    sandbox,
    "configure gh auth marker",
    [
      "mkdir -p ~/.config/gh",
      "cat > ~/.config/gh/hosts.yml <<'EOF'",
      "github.com:",
      "    git_protocol: https",
      "    oauth_token: impel-firewall-auth",
      "    user: x-access-token",
      "EOF",
    ].join("\n"),
  );
}

/** Persist a lightweight run-context marker (repos + auth to clone them) to the
 * shared sandbox BEFORE the checkout completes, so a co-resident subagent can
 * recover the parent's repos even mid-prep. */
async function writeRunContextMarker(
  sandbox: SandboxSession,
  runContext: ImpelEveRunContext,
  checkoutPlan: { layout: ImpelWorkspaceLayout; repos: readonly ImpelPlannedRepoCheckout[] },
): Promise<void> {
  const metadata = {
    preparedAt: new Date().toISOString(),
    pending: true,
    layout: checkoutPlan.layout,
    workspaceRoot: "/workspace",
    orgId: runContext.orgId,
    runId: runContext.runId,
    traceId: runContext.traceId,
    branch: runContext.branch,
    installationId: runContext.installationId,
    githubConnectorUid: runContext.githubConnectorUid,
    codeIntelligence: runContext.codeIntelligence,
    repos: checkoutPlan.repos.map((repo) => ({
      repo: repo.repo,
      path: repo.path,
      sha: "",
    })),
  };
  try {
    await sandbox.writeTextFile({
      path: "/workspace/.impel/run-context.json",
      content: JSON.stringify(metadata, null, 2),
    });
  } catch {
    // Best-effort: the full metadata write after checkout is the source of truth.
  }
}

async function writeWorkspaceMetadata(
  sandbox: SandboxSession,
  runContext: ImpelEveRunContext,
  repos: ImpelPreparedRepo[],
  layout: ImpelWorkspaceLayout,
): Promise<void> {
  const metadata = {
    preparedAt: new Date().toISOString(),
    layout,
    workspaceRoot: "/workspace",
    orgId: runContext.orgId,
    runId: runContext.runId,
    traceId: runContext.traceId,
    branch: runContext.branch,
    // installationId/connectorUid persisted so a co-resident subagent (built-in
    // `agent` tool, shares this sandbox) can recover the repos AND mint a
    // checkout token to clone them itself — the parent's clientContext never
    // reaches the child's session directly.
    installationId: runContext.installationId,
    githubConnectorUid: runContext.githubConnectorUid,
    codeIntelligence: runContext.codeIntelligence,
    repos,
  };
  const lines = [
    "# Impel Eve Workspace",
    "",
    "This workspace was prepared from the Impel Eve client context.",
    "",
    layout === "multi-repo-directory"
      ? "/workspace is a coordination directory, not a git checkout. Run git commands inside one of the repo directories below."
      : "/workspace is the attached git checkout.",
    "",
    ...repos.map(
      (repo, index) =>
        `- ${index === 0 ? "Primary" : "Additional"} repo ${repo.repo} at ${repo.path} (${repo.sha})`,
    ),
    "",
  ];

  await runSandboxCommand(
    sandbox,
    "create metadata directory",
    "mkdir -p /workspace/.impel",
  );
  await sandbox.writeTextFile({
    path: "/workspace/.impel/run-context.json",
    content: JSON.stringify(metadata, null, 2),
  });
  await sandbox.writeTextFile({
    path: "/workspace/README_IMPEL_WORKSPACE.md",
    content: lines.join("\n"),
  });
}

async function runSandboxCommand(
  sandbox: SandboxSession,
  label: string,
  command: string,
): Promise<{ stdout: string; stderr: string }> {
  const result = await sandbox.run({ command });
  const stdout = String(result.stdout ?? "");
  const stderr = String(result.stderr ?? "");
  if (result.exitCode === 0) return { stdout, stderr };

  throw new Error(
    [
      `Impel Eve workspace setup failed during ${label} (exit ${result.exitCode}).`,
      stderr ? `stderr: ${redact(stderr)}` : undefined,
      stdout ? `stdout: ${redact(stdout)}` : undefined,
    ]
      .filter((line): line is string => Boolean(line))
      .join(" "),
  );
}

function buildGitHubBrokerNetworkPolicy(token: string): SandboxNetworkPolicy {
  const basic = `Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`;
  const bearer = `Bearer ${token}`;
  return {
    allow: {
      "github.com": [{ transform: [{ headers: { authorization: basic } }] }],
      "codeload.github.com": [
        { transform: [{ headers: { authorization: basic } }] },
      ],
      "api.github.com": [
        { transform: [{ headers: { authorization: bearer } }] },
      ],
      "*": [],
    },
  };
}

// Read-only permission set for brokered reference-repo access, expressed in both
// the Vercel Connect (array) and GitHub installation-token API (object) shapes.
const REFERENCE_REPO_CONNECT_PERMISSIONS = [
  "contents:read",
  "metadata:read",
] as const;
const REFERENCE_REPO_INSTALLATION_PERMISSIONS = {
  contents: "read",
  metadata: "read",
} as const;

interface ResolveGitHubAccessTokenOptions {
  scopeRepositories?: readonly string[];
  readOnly?: boolean;
  identityRunToken?: string | null;
}

// Centralized resolution through the impel-identity service. Dark unless the
// deployment sets IMPEL_IDENTITY_URL AND the dispatcher sent a signed v1
// identityRunToken. The service resolves the org's registry entry itself — the
// caller-asserted installationId is not consulted. Once this explicit
// centralized path is selected, every HTTP/network/payload failure fails closed
// instead of falling through to broader local credentials.
async function resolveImpelIdentityGitHubToken(
  runContext: ImpelEveRunContext,
  options: ResolveGitHubAccessTokenOptions,
): Promise<string | null> {
  const baseUrl = process.env.IMPEL_IDENTITY_URL?.trim();
  const identityRunToken = options.identityRunToken ?? null;
  if (!baseUrl || !identityRunToken) return null;
  if (!identityRunToken.startsWith("v1.")) {
    throw new ImpelIdentityResolveError({
      code: "invalid_assertion",
      message: "Impel identity resolution requires a v1 server assertion.",
    });
  }
  const repos =
    options.scopeRepositories ??
    (runContext.repos?.length ? runContext.repos : undefined);
  let response: Response;
  try {
    response = await fetch(new URL("/v1/resolve", baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-impel-run-token": identityRunToken,
      },
      body: JSON.stringify({
        provider: "github",
        role: options.readOnly ? "read" : "write",
        ...(repos ? { repos: [...repos] } : {}),
        purpose: "eve-workspace",
      }),
      signal: AbortSignal.timeout(7_000),
    });
  } catch {
    throw new ImpelIdentityResolveError({
      code: "unreachable",
      message: "Impel identity resolution is unavailable.",
    });
  }
  if (!response.ok) {
    throw new ImpelIdentityResolveError({
      code: "http_error",
      message: `Impel identity resolution failed with HTTP ${response.status}.`,
      status: response.status,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ImpelIdentityResolveError({
      code: "invalid_response",
      message: "Impel identity resolution returned an invalid response.",
    });
  }
  const token = isRecord(payload) ? readString(payload.token) : undefined;
  if (!token) {
    throw new ImpelIdentityResolveError({
      code: "invalid_response",
      message: "Impel identity resolution returned an empty token.",
    });
  }
  return token;
}

async function resolveGitHubAccessToken(
  runContext: ImpelEveRunContext,
  options: ResolveGitHubAccessTokenOptions = {},
): Promise<string> {
  const { scopeRepositories, readOnly = false } = options;

  // When a deployment opts into centralized resolution and supplies its v1
  // assertion, the service wins over every local path (including stray static
  // tokens) and its failures are terminal.
  const identityToken = await resolveImpelIdentityGitHubToken(
    runContext,
    options,
  );
  if (identityToken) return identityToken;

  const staticToken =
    process.env.IMPEL_EVE_GITHUB_TOKEN ??
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN;
  if (staticToken) return staticToken;

  const connectToken = await resolveVercelConnectGitHubToken(
    runContext,
    readOnly,
  );
  if (connectToken) return connectToken;

  if (runContext.installationId !== undefined) {
    return createGitHubInstallationToken(String(runContext.installationId), {
      repositories: scopeRepositories,
      permissions: readOnly
        ? REFERENCE_REPO_INSTALLATION_PERMISSIONS
        : undefined,
    });
  }

  throw new Error(
    "Attached repo checkout requires Vercel Connect GitHub app-subject access, clientContext.installationId with GitHub App fallback env, or a static IMPEL_EVE_GITHUB_TOKEN/GITHUB_TOKEN/GH_TOKEN.",
  );
}

async function resolveVercelConnectGitHubToken(
  runContext: ImpelEveRunContext,
  readOnly = false,
): Promise<string | null> {
  if (process.env.IMPEL_EVE_GITHUB_CONNECT_ENABLED === "0") return null;

  let connect: VercelConnectModule | null;
  try {
    connect =
      (await import("@vercel/connect")) as unknown as VercelConnectModule;
  } catch {
    return null;
  }
  if (!connect) return null;

  try {
    const response = await connect.getTokenResponse(
      resolveVercelConnectGitHubConnectorUid(runContext.githubConnectorUid),
      createVercelConnectGitHubTokenParams(runContext, readOnly),
    );
    return typeof response.token === "string" ? response.token : null;
  } catch (error) {
    if (hasGitHubAppFallbackEnv()) return null;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Vercel Connect could not mint a GitHub installation token for Eve workspace checkout. ${message}`,
    );
  }
}

export function resolveVercelConnectGitHubConnectorUid(
  value = process.env.VERCEL_GITHUB_CONNECTOR_UID,
): string {
  return readString(value) ?? DEFAULT_GITHUB_CONNECTOR_UID;
}

export function createVercelConnectGitHubTokenParams(
  runContext: ImpelEveRunContext,
  readOnly = false,
): Record<string, unknown> {
  const repositoryNames = githubRepositoryNamesFromRunContext(runContext);
  const permissions = readOnly
    ? [...REFERENCE_REPO_CONNECT_PERMISSIONS]
    : ["contents:write", "pull_requests:write", "checks:read", "statuses:read"];

  return stripUndefined({
    subject: { type: "app" },
    installationId:
      runContext.installationId === undefined
        ? undefined
        : String(runContext.installationId),
    authorizationDetails:
      repositoryNames.length > 0
        ? [
            {
              type: "github_app_installation",
              repositories:
                repositoryNames.length === 1
                  ? repositoryNames[0]
                  : repositoryNames,
              permissions,
            },
          ]
        : undefined,
  });
}

function githubRepositoryNamesFromRunContext(
  runContext: ImpelEveRunContext,
): string[] {
  const names = new Set<string>();
  for (const repoName of runContext.repos ?? []) {
    names.add(parseGitHubRepo(repoName).repo);
  }
  return Array.from(names);
}

const githubInstallationTokenCache = new Map<string, GitHubInstallationToken>();

interface CreateGitHubInstallationTokenOptions {
  repositories?: readonly string[];
  permissions?: Readonly<Record<string, string>>;
}

async function createGitHubInstallationToken(
  installationId: string,
  options: CreateGitHubInstallationTokenOptions = {},
): Promise<string> {
  const { repositories, permissions } = options;
  const apiBaseUrl =
    process.env.IMPEL_EVE_GITHUB_API_URL ?? "https://api.github.com";
  const appId =
    process.env.IMPEL_EVE_GITHUB_APP_ID ?? process.env.GITHUB_APP_ID;
  const privateKey =
    process.env.IMPEL_EVE_GITHUB_APP_PRIVATE_KEY ??
    process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error(
      "Attached repo checkout requires Vercel Connect GitHub app-subject access, GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY, or a static IMPEL_EVE_GITHUB_TOKEN/GITHUB_TOKEN/GH_TOKEN.",
    );
  }

  // Optionally scope the token to specific repositories and/or reduced
  // permissions (least privilege). The GitHub API expects bare repo names (no
  // owner); an empty list means the token covers the whole installation,
  // preserving the historical unscoped behavior.
  const scope = (repositories ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .sort();
  const permissionKey = permissions
    ? Object.entries(permissions)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join(",")
    : "";
  const cacheKey = `${apiBaseUrl}:${appId}:${installationId}:${scope.join(",")}:${permissionKey}`;
  const cached = githubInstallationTokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAtMs - 60_000) {
    return cached.token;
  }

  const requestBody = stripUndefined({
    repositories: scope.length > 0 ? scope : undefined,
    permissions:
      permissions && Object.keys(permissions).length > 0
        ? permissions
        : undefined,
  });
  const jwt = createGitHubAppJwt(appId, normalizePrivateKey(privateKey));
  const response = await fetch(
    `${apiBaseUrl}/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${jwt}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body:
        Object.keys(requestBody).length > 0
          ? JSON.stringify(requestBody)
          : undefined,
    },
  );
  const body = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(
      `GitHub installation token request failed with HTTP ${response.status}.`,
    );
  }
  if (!isRecord(body) || typeof body.token !== "string") {
    throw new Error(
      "GitHub installation token response did not include a token.",
    );
  }

  const token = body.token;
  githubInstallationTokenCache.set(cacheKey, {
    token,
    expiresAtMs: parseExpiryMs(body.expires_at),
  });
  return token;
}

function createGitHubAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { exp: now + 600, iat: now - 60, iss: appId };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  return `${signingInput}.${createSign("RSA-SHA256")
    .update(signingInput)
    .sign(privateKey, "base64url")}`;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parseExpiryMs(value: unknown): number {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now() + 60 * 60 * 1000;
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function hasGitHubAppFallbackEnv(): boolean {
  return Boolean(
    (process.env.IMPEL_EVE_GITHUB_APP_ID ?? process.env.GITHUB_APP_ID) &&
    (process.env.IMPEL_EVE_GITHUB_APP_PRIVATE_KEY ??
      process.env.GITHUB_APP_PRIVATE_KEY),
  );
}

function parseGitHubRepo(value: string): GitHubRepoRef {
  const [owner, repo, ...rest] = value.split("/");
  if (!owner || !repo || rest.length > 0) {
    throw new Error(
      `Invalid GitHub repository name "${value}". Expected owner/repo.`,
    );
  }
  return { owner, repo, fullName: `${owner}/${repo}` };
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "__");
}

function readCheckoutDepthFromEnv(): number {
  const raw = process.env.IMPEL_EVE_GITHUB_CHECKOUT_DEPTH;
  if (raw === undefined || raw.trim() === "") return 0;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readV1RunToken(value: unknown): string | null {
  const token = readString(value);
  return token?.startsWith("v1.") ? token : null;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function redact(value: string): string {
  return value
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, "<github-token>")
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "<github-token>")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer <redacted>")
    .replace(/\bBasic\s+[A-Za-z0-9+/=]+/gi, "Basic <redacted>");
}
