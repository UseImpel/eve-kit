import { createSign } from "node:crypto";
import {
  defineChannel,
  GET,
  POST,
  type Channel,
  type RouteHandlerArgs,
  type SendOptions,
  type SendPayload,
} from "eve/channels";
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

  const auth = [
    localDev(),
    vercelOidc(),
    ...basic,
    ...(includePlaceholderAuth ? [placeholderAuth()] : []),
  ];

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
    routes: createImpelEveRoutes(auth),
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
  return [toClientContextMessage(JSON.stringify(assertJsonSerializable(value)))];
}

function toClientContextMessage(value: string): string {
  return `Client context:\n${value}`;
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
  const checkoutPlan = createWorkspaceCheckoutPlan(runContext.repos);
  const workspaceKey = createWorkspaceKey(runContext, {
    checkoutDepth: options.checkoutDepth,
    layout: checkoutPlan.layout,
    repos: checkoutPlan.repos,
  });
  if (
    state.workspace.prepared &&
    state.workspace.sandboxId === sandbox.id &&
    state.workspace.key === workspaceKey
  ) {
    return;
  }

  try {
    const token = await resolveGitHubAccessToken(runContext);
    await sandbox.setNetworkPolicy(buildGitHubBrokerNetworkPolicy(token));
    await configureGitHubCliAuthMarker(sandbox);
    await prepareWorkspaceRoot(sandbox, checkoutPlan.layout);

    const prepared: ImpelPreparedRepo[] = [];
    for (const planned of checkoutPlan.repos) {
      const checkout = await checkoutGitHubRepository(sandbox, planned.repoRef, {
        depth: options.checkoutDepth,
        path: planned.path,
        ref: runContext.branch ?? "HEAD",
      });
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
    throw error;
  }
}

function createImpelEveRoutes(
  auth: readonly AuthFn<Request>[],
) {
  return [
    POST<ImpelEveChannelState>("/eve/v1/session", async (request, args) => {
      const authorized = await routeAuth(request, auth);
      if (authorized instanceof Response) return authorized;

      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;

      const parsed = parseCreateSessionBody(body);
      if (parsed instanceof Response) return parsed;

      const state = createImpelEveChannelState(
        normalizeImpelEveRunContext(parsed.clientContext),
      );
      const session = await args.send(
        createSendPayload(parsed),
        withState(
          {
            auth: authorized,
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

        const state = createImpelEveChannelState(
          normalizeImpelEveRunContext(parsed.clientContext),
        );
        const session = await args.send(
          createSendPayload(parsed),
          withState(
            {
              auth: authorized,
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

async function parseJsonBody(request: Request): Promise<Record<string, unknown> | Response> {
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
    typeof body.continuationToken === "string" && body.continuationToken.length > 0
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

function parseMessageField(value: unknown): string | UserContent | undefined | Response {
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

function parseClientContextField(value: unknown): string[] | undefined | Response {
  try {
    return normalizeClientContextMessages(value);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 400);
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

function parseModeField(value: unknown): "conversation" | "task" | undefined | Response {
  if (value === undefined) return undefined;
  if (value === "conversation" || value === "task") return value;
  return jsonError("Expected 'mode' to be either 'conversation' or 'task'.", 400);
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
    return jsonError(error instanceof Error ? error.message : String(error), 400);
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

function assertJsonSerializable(value: Record<string, unknown>): Record<string, unknown> {
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

function countRepoNames(repoRefs: readonly GitHubRepoRef[]): Map<string, number> {
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
  },
): string {
  return JSON.stringify({
    branch: runContext.branch ?? "HEAD",
    checkoutDepth: plan.checkoutDepth,
    layout: plan.layout,
    repos: plan.repos.map((repo) => ({
      path: repo.path,
      repo: repo.repo,
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

  let connect: VercelConnectModule | null;
  try {
    connect = (await import("@vercel/connect")) as unknown as VercelConnectModule;
  } catch {
    return null;
  }
  if (!connect) return null;

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
  const repositoryNames = githubRepositoryNamesFromRunContext(runContext);

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
              permissions: "contents:read",
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
