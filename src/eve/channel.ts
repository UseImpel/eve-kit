import { createSign } from "node:crypto";
import {
  defineChannel,
  type Channel,
  type RouteDefinition,
  type RouteHandlerArgs,
  type SendFn,
} from "eve/channels";
import { eveChannel } from "eve/channels/eve";
import {
  httpBasic,
  localDev,
  placeholderAuth,
  vercelOidc,
} from "eve/channels/auth";
import type { SandboxNetworkPolicy, SandboxSession } from "eve/sandbox";

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

type ImpelEveChannelContext = {
  state: ImpelEveChannelState;
};

export type ImpelEveChannel = Channel<
  ImpelEveChannelState,
  Record<string, never>,
  {
    orgId?: string;
    runId?: string;
    traceId?: string;
    repos?: string[];
    workspacePrepared: boolean;
  }
>;

interface GitHubRepoRef {
  owner: string;
  repo: string;
  fullName: string;
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
const optionalImport = new Function(
  "specifier",
  "return import(specifier)",
) as (specifier: string) => Promise<unknown>;

export function defaultImpelEveChannel({
  basicUser = process.env.EVE_APP_BASIC_USER ?? process.env.IMPEL_EVE_BASIC_USER,
  basicPassword =
    process.env.EVE_APP_BASIC_PASSWORD ?? process.env.IMPEL_EVE_BASIC_PASSWORD,
  includePlaceholderAuth = false,
  prepareAttachedRepos = true,
  checkoutDepth = readCheckoutDepthFromEnv(),
}: DefaultImpelEveChannelOptions = {}): ImpelEveChannel {
  const basic =
    basicUser && basicPassword
      ? [httpBasic({ username: basicUser, password: basicPassword })]
      : [];

  const base = eveChannel({
    auth: [
      localDev(),
      vercelOidc(),
      ...basic,
      ...(includePlaceholderAuth ? [placeholderAuth()] : []),
    ],
  });

  return defineChannel<
    ImpelEveChannelState,
    ImpelEveChannelContext,
    Record<string, never>,
    {
      orgId?: string;
      runId?: string;
      traceId?: string;
      repos?: string[];
      workspacePrepared: boolean;
    }
  >({
    state: createImpelEveChannelState(null),
    context(state) {
      return { state };
    },
    metadata(state) {
      return {
        orgId: state.runContext?.orgId,
        runId: state.runContext?.runId,
        traceId: state.runContext?.traceId,
        repos: state.runContext?.repos,
        workspacePrepared: state.workspace.prepared,
      };
    },
    routes: base.routes.map((route) => wrapEveRouteWithImpelState(route)),
    events: {
      async "turn.started"(_event, channel, ctx) {
        if (!prepareAttachedRepos) return;
        await prepareImpelEveWorkspace(channel.state, {
          checkoutDepth,
          getSandbox: () => ctx.getSandbox(),
        });
      },
    },
  });
}

export function createImpelEveChannelState(
  runContext: ImpelEveRunContext | null,
): ImpelEveChannelState {
  return {
    runContext,
    workspace: {
      prepared: false,
      sandboxId: null,
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
    runId: readString(value.runId),
    traceId: readString(value.traceId),
    agent: isRecord(value.agent) ? value.agent : undefined,
    btParent: readString(value.btParent),
  });
}

async function prepareImpelEveWorkspace(
  state: ImpelEveChannelState,
  options: {
    checkoutDepth: number;
    getSandbox: () => Promise<SandboxSession>;
  },
): Promise<void> {
  const runContext = state.runContext;
  if (!runContext?.repos?.length) return;

  const sandbox = await options.getSandbox();
  if (
    state.workspace.prepared &&
    state.workspace.sandboxId === sandbox.id &&
    state.workspace.repos.length === runContext.repos.length
  ) {
    return;
  }

  try {
    const token = await resolveGitHubAccessToken(runContext);
    await sandbox.setNetworkPolicy(buildGitHubBrokerNetworkPolicy(token));
    await configureGitHubCliAuthMarker(sandbox);

    const prepared: ImpelPreparedRepo[] = [];
    for (const [index, repoName] of runContext.repos.entries()) {
      const repo = parseGitHubRepo(repoName);
      const checkout = await checkoutGitHubRepository(sandbox, repo, {
        depth: options.checkoutDepth,
        path: checkoutPathForRepo(repo, index),
        ref: runContext.branch ?? "HEAD",
      });
      prepared.push(checkout);
    }

    await writeWorkspaceMetadata(sandbox, runContext, prepared);
    state.workspace = {
      prepared: true,
      sandboxId: sandbox.id,
      repos: prepared,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.workspace = {
      prepared: false,
      sandboxId: sandbox.id,
      repos: [],
      error: message,
    };
    throw error;
  }
}

function wrapEveRouteWithImpelState(
  route: RouteDefinition<undefined>,
): RouteDefinition<ImpelEveChannelState> {
  if (route.transport === "websocket") {
    return route as unknown as RouteDefinition<ImpelEveChannelState>;
  }

  return {
    ...route,
    async handler(request, args) {
      const runContext = await extractImpelEveRunContextFromRequest(request);
      const state = createImpelEveChannelState(runContext);
      const send = buildStatefulSend(args, state);
      return route.handler(request, {
        ...args,
        send,
      } as unknown as RouteHandlerArgs<undefined>);
    },
  };
}

function buildStatefulSend(
  args: RouteHandlerArgs<ImpelEveChannelState>,
  state: ImpelEveChannelState,
): SendFn<undefined> {
  return async (input, options) =>
    args.send(input, {
      ...options,
      state,
    });
}

async function checkoutGitHubRepository(
  sandbox: SandboxSession,
  repo: GitHubRepoRef,
  options: {
    depth: number;
    path: string;
    ref: string;
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
  await runSandboxCommand(sandbox, "initialize git repository", `cd ${shellQuote(path)} && git init`);
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
  await runSandboxCommand(
    sandbox,
    "fetch GitHub ref",
    `cd ${shellQuote(path)} && GIT_TERMINAL_PROMPT=0 git fetch${depthFlag} origin ${shellQuote(ref)}`,
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

async function writeWorkspaceMetadata(
  sandbox: SandboxSession,
  runContext: ImpelEveRunContext,
  repos: ImpelPreparedRepo[],
): Promise<void> {
  const metadata = {
    preparedAt: new Date().toISOString(),
    orgId: runContext.orgId,
    runId: runContext.runId,
    traceId: runContext.traceId,
    branch: runContext.branch,
    repos,
  };
  const lines = [
    "# Impel Eve Workspace",
    "",
    "This workspace was prepared from the Impel Eve client context.",
    "",
    ...repos.map((repo, index) =>
      `- ${index === 0 ? "Primary" : "Additional"} repo ${repo.repo} at ${repo.path} (${repo.sha})`,
    ),
    "",
  ];

  await runSandboxCommand(sandbox, "create metadata directory", "mkdir -p /workspace/.impel");
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

function buildGitHubBrokerNetworkPolicy(
  token: string,
): SandboxNetworkPolicy {
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

async function resolveGitHubAccessToken(
  runContext: ImpelEveRunContext,
): Promise<string> {
  const staticToken =
    process.env.IMPEL_EVE_GITHUB_TOKEN ??
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN;
  if (staticToken) return staticToken;

  const connectToken = await resolveVercelConnectGitHubToken(runContext);
  if (connectToken) return connectToken;

  if (runContext.installationId !== undefined) {
    return createGitHubInstallationToken(String(runContext.installationId));
  }

  throw new Error(
    "Attached repo checkout requires Vercel Connect GitHub app-subject access, clientContext.installationId with GitHub App fallback env, or a static IMPEL_EVE_GITHUB_TOKEN/GITHUB_TOKEN/GH_TOKEN.",
  );
}

async function resolveVercelConnectGitHubToken(
  runContext: ImpelEveRunContext,
): Promise<string | null> {
  if (process.env.IMPEL_EVE_GITHUB_CONNECT_ENABLED === "0") return null;

  let connect: VercelConnectModule;
  try {
    connect = (await optionalImport("@vercel/connect")) as VercelConnectModule;
  } catch {
    return null;
  }

  try {
    const response = await connect.getTokenResponse(
      resolveVercelConnectGitHubConnectorUid(),
      createVercelConnectGitHubTokenParams(runContext),
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
): Record<string, unknown> {
  return stripUndefined({
    subject: { type: "app" },
    installationId:
      runContext.installationId === undefined
        ? undefined
        : String(runContext.installationId),
  });
}

const githubInstallationTokenCache = new Map<string, GitHubInstallationToken>();

async function createGitHubInstallationToken(
  installationId: string,
): Promise<string> {
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

  const cacheKey = `${apiBaseUrl}:${appId}:${installationId}`;
  const cached = githubInstallationTokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAtMs - 60_000) {
    return cached.token;
  }

  const jwt = createGitHubAppJwt(appId, normalizePrivateKey(privateKey));
  const response = await fetch(
    `${apiBaseUrl}/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${jwt}`,
        "x-github-api-version": "2022-11-28",
      },
    },
  );
  const body = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(
      `GitHub installation token request failed with HTTP ${response.status}.`,
    );
  }
  if (!isRecord(body) || typeof body.token !== "string") {
    throw new Error("GitHub installation token response did not include a token.");
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
    throw new Error(`Invalid GitHub repository name "${value}". Expected owner/repo.`);
  }
  return { owner, repo, fullName: `${owner}/${repo}` };
}

function checkoutPathForRepo(repo: GitHubRepoRef, index: number): string {
  if (index === 0) return "/workspace";
  return `/workspace/repos/${safePathSegment(repo.fullName)}`;
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
