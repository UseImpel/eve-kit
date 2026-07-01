import path from "node:path";
import type { SandboxSession } from "eve/sandbox";
import type { ToolContext, ToolDefinition } from "eve/tools";
import {
  createImpelEveChannelState,
  createImpelWorkspaceContextMessage,
  normalizeImpelEveRunContext,
  planImpelEveRepoCheckouts,
  prepareImpelEveWorkspace,
  type ImpelEveChannelState,
  type ImpelEveRunContext,
  type ImpelPlannedRepoCheckout,
  type ImpelPreparedRepo,
  type ImpelWorkspaceLayout,
} from "./channel.js";

const posix = path.posix;

export type WorkspaceToolName =
  | "bash"
  | "glob"
  | "grep"
  | "read_file"
  | "write_file";
export type WorkspaceToolMode = "read-only" | "read-write";

type WorkspaceResolveContext = {
  readonly session: { readonly id: string };
  readonly channel?: {
    readonly metadata?: Readonly<Record<string, unknown>>;
  };
};
type WorkspaceToolContext = ToolContext & WorkspaceResolveContext;

type PreparedWorkspace = {
  readonly sandbox: SandboxSession;
  readonly runContext: ImpelEveRunContext;
  readonly state: ImpelEveChannelState;
  readonly plannedRepos: readonly ImpelPlannedRepoCheckout[];
};

type PersistedWorkspaceMetadata = {
  readonly branch?: string;
  readonly layout: ImpelWorkspaceLayout;
  readonly orgId?: string;
  readonly repos: readonly ImpelPreparedRepo[];
  readonly runId?: string;
  readonly traceId?: string;
  readonly workspaceRoot: "/workspace";
};

type WorkspaceMetadataFields = {
  readonly layout: ImpelWorkspaceLayout;
  readonly repos: readonly ImpelPreparedRepo[];
  readonly source: Readonly<Record<string, unknown>>;
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

const MAX_WORKSPACE_CACHE_ENTRIES = 500;
const runContextsBySessionId = new Map<string, ImpelEveRunContext>();
const workspaceStatesByKey = new Map<string, ImpelEveChannelState>();
const emptyRecord: Readonly<Record<string, unknown>> = {};

const workspacePathReaders: Record<
  WorkspaceToolName,
  (record: Readonly<Record<string, unknown>>) => string[]
> = {
  bash: (record) => workspacePathsFromCommand(readString(record.command) ?? ""),
  glob: readSearchToolWorkspacePaths,
  grep: readSearchToolWorkspacePaths,
  read_file: readFileToolWorkspacePaths,
  write_file: readFileToolWorkspacePaths,
};

class WorkspaceToolBlockedError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestedPaths: readonly string[] = [],
  ) {
    super(message);
    this.name = "WorkspaceToolBlockedError";
  }
}

export async function runWithPreparedImpelWorkspace<TInput, TOutput>(
  tool: ToolDefinition<TInput, TOutput>,
  input: TInput,
  ctx: ToolContext,
  options: RunWithPreparedWorkspaceOptions = {},
): Promise<TOutput | WorkspaceToolFailure> {
  const workspaceCtx = ctx as WorkspaceToolContext;
  try {
    const prepared = await prepareImpelWorkspaceForTool(workspaceCtx);
    await assertWorkspaceToolInputIsValid(prepared, input, {
      mode: options.mode ?? "read-write",
      toolName: options.toolName,
    });
    return await tool.execute(input, ctx);
  } catch (error) {
    return workspaceToolFailure(error, workspaceCtx, input, options.toolName);
  }
}

export async function describePreparedImpelWorkspace(
  ctx: ToolContext,
): Promise<
  | {
      ok: true;
      layout: ImpelEveChannelState["workspace"]["layout"];
      message: string;
      repos: readonly ImpelPlannedRepoCheckout[];
      workspacePrepared: boolean;
    }
  | WorkspaceToolFailure
> {
  const workspaceCtx = ctx as WorkspaceToolContext;
  try {
    const prepared = await prepareImpelWorkspaceForTool(workspaceCtx);
    return {
      ok: true,
      layout: prepared.state.workspace.layout,
      message:
        createImpelWorkspaceContextMessage(prepared.runContext) ??
        "No Impel workspace context is attached.",
      repos: prepared.plannedRepos,
      workspacePrepared: prepared.state.workspace.prepared,
    };
  } catch (error) {
    return workspaceToolFailure(error, workspaceCtx, {}, "workspace");
  }
}

export function rememberImpelWorkspaceRunContext(
  ctx: WorkspaceResolveContext,
): ImpelEveRunContext | undefined {
  const runContext = normalizeImpelEveRunContext(ctx.channel?.metadata);
  if (runContext?.repos?.length) {
    rememberImpelWorkspaceRunContextForSession(ctx.session.id, runContext);
    return runContext;
  }
  return runContextsBySessionId.get(ctx.session.id);
}

function rememberImpelWorkspaceRunContextForSession(
  sessionId: string,
  runContext: ImpelEveRunContext,
): void {
  runContextsBySessionId.set(sessionId, runContext);
  pruneWorkspaceCache();
}

async function prepareImpelWorkspaceForTool(
  ctx: WorkspaceToolContext,
): Promise<PreparedWorkspace> {
  const sandbox = await ctx.getSandbox();
  const restored = await preparedWorkspaceFromSandboxMetadata(
    ctx.session.id,
    sandbox,
  );
  if (restored) return restored;

  const runContext = requireImpelWorkspaceRunContext(ctx);
  const state = workspaceStateForRun(ctx.session.id, runContext);
  await prepareWorkspaceState(state, sandbox);
  const plannedRepos = planImpelEveRepoCheckouts(runContext.repos ?? []);
  await assertWorkspaceRootExists(sandbox);

  return { sandbox, runContext, state, plannedRepos };
}

async function preparedWorkspaceFromSandboxMetadata(
  sessionId: string,
  sandbox: SandboxSession,
): Promise<PreparedWorkspace | undefined> {
  const metadata = await readPreparedWorkspaceMetadata(sandbox);
  if (!metadata) return undefined;

  const runContext = runContextFromPreparedWorkspaceMetadata(metadata);
  rememberImpelWorkspaceRunContextForSession(sessionId, runContext);
  const plannedRepos = plannedReposFromPreparedWorkspaceMetadata(metadata);
  const state = stateFromPreparedWorkspaceMetadata(
    sandbox,
    runContext,
    metadata,
  );

  await assertWorkspaceRootExists(sandbox);
  return { sandbox, runContext, state, plannedRepos };
}

async function readPreparedWorkspaceMetadata(
  sandbox: SandboxSession,
): Promise<PersistedWorkspaceMetadata | undefined> {
  const raw = await readPreparedWorkspaceMetadataJson(sandbox);
  return raw ? parsePreparedWorkspaceMetadata(raw) : undefined;
}

async function readPreparedWorkspaceMetadataJson(
  sandbox: SandboxSession,
): Promise<unknown | undefined> {
  try {
    const result = await sandbox.run({
      command: "cat /workspace/.impel/run-context.json",
    });
    const raw = successfulSandboxStdout(result);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function successfulSandboxStdout(result: {
  readonly exitCode: number;
  readonly stdout?: unknown;
}): string | undefined {
  if (result.exitCode !== 0) return undefined;
  return readString(String(result.stdout ?? ""));
}

function parsePreparedWorkspaceMetadata(
  value: unknown,
): PersistedWorkspaceMetadata | undefined {
  const fields = readWorkspaceMetadataFields(value);
  if (!fields) return undefined;
  return {
    layout: fields.layout,
    workspaceRoot: "/workspace",
    repos: fields.repos,
    ...readOptionalWorkspaceMetadataStrings(fields.source),
  };
}

function readWorkspaceMetadataFields(
  value: unknown,
): WorkspaceMetadataFields | undefined {
  if (!isRecord(value)) return undefined;
  const layout = readWorkspaceMetadataLayout(value);
  const repos = readPreparedWorkspaceRepos(value.repos);
  return layout && repos.length > 0
    ? { source: value, layout, repos }
    : undefined;
}

function readWorkspaceMetadataLayout(
  value: Readonly<Record<string, unknown>>,
): ImpelWorkspaceLayout | undefined {
  return readString(value.workspaceRoot) === "/workspace"
    ? readWorkspaceLayout(value.layout)
    : undefined;
}

function readPreparedWorkspaceRepos(value: unknown): ImpelPreparedRepo[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(readPreparedWorkspaceRepo)
    .filter((repo): repo is ImpelPreparedRepo => repo !== undefined);
}

function readOptionalWorkspaceMetadataStrings(
  record: Readonly<Record<string, unknown>>,
): Pick<
  PersistedWorkspaceMetadata,
  "branch" | "orgId" | "runId" | "traceId"
> {
  return {
    ...optionalStringProperty("orgId", record.orgId),
    ...optionalStringProperty("runId", record.runId),
    ...optionalStringProperty("traceId", record.traceId),
    ...optionalStringProperty("branch", record.branch),
  };
}

function runContextFromPreparedWorkspaceMetadata(
  metadata: PersistedWorkspaceMetadata,
): ImpelEveRunContext {
  const runContext: ImpelEveRunContext = {
    repos: metadata.repos.map((repo) => repo.repo),
  };
  copyStringProperty(runContext, "orgId", metadata.orgId);
  copyStringProperty(runContext, "branch", metadata.branch);
  copyStringProperty(runContext, "runId", metadata.runId);
  copyStringProperty(runContext, "traceId", metadata.traceId);
  return runContext;
}

function plannedReposFromPreparedWorkspaceMetadata(
  metadata: PersistedWorkspaceMetadata,
): ImpelPlannedRepoCheckout[] {
  return metadata.repos.map((repo, index) => ({
    repo: repo.repo,
    path: repo.path,
    role: index === 0 ? "primary" : "additional",
  }));
}

function stateFromPreparedWorkspaceMetadata(
  sandbox: SandboxSession,
  runContext: ImpelEveRunContext,
  metadata: PersistedWorkspaceMetadata,
): ImpelEveChannelState {
  return {
    runContext,
    workspace: {
      prepared: true,
      sandboxId: sandbox.id,
      key: null,
      layout: metadata.layout,
      repos: [...metadata.repos],
      error: null,
    },
  };
}

function readPreparedWorkspaceRepo(
  value: unknown,
): ImpelPreparedRepo | undefined {
  if (!isRecord(value)) return undefined;
  const fields = readRequiredStringFields(value, ["repo", "path", "ref", "sha"]);
  return fields
    ? {
        repo: fields.repo,
        path: fields.path,
        ref: fields.ref,
        sha: fields.sha,
      }
    : undefined;
}

function readWorkspaceLayout(value: unknown): ImpelWorkspaceLayout | undefined {
  return value === "single-repo-root" || value === "multi-repo-directory"
    ? value
    : undefined;
}

function optionalStringProperty<TKey extends string>(
  key: TKey,
  value: unknown,
): Partial<Record<TKey, string>> {
  const stringValue = readString(value);
  return stringValue
    ? ({ [key]: stringValue } as Partial<Record<TKey, string>>)
    : {};
}

function copyStringProperty<TKey extends keyof ImpelEveRunContext>(
  target: ImpelEveRunContext,
  key: TKey,
  value: ImpelEveRunContext[TKey],
): void {
  if (typeof value === "string") {
    target[key] = value;
  }
}

function readRequiredStringFields<TKey extends string>(
  record: Readonly<Record<string, unknown>>,
  keys: readonly TKey[],
): Record<TKey, string> | undefined {
  const entries = keys.map((key) => [key, readString(record[key])] as const);
  if (entries.some(([, value]) => value === undefined)) return undefined;
  return Object.fromEntries(entries) as Record<TKey, string>;
}

function requireImpelWorkspaceRunContext(
  ctx: WorkspaceResolveContext,
): ImpelEveRunContext {
  const runContext = rememberImpelWorkspaceRunContext(ctx);
  if (runContext?.repos?.length) return runContext;

  throw new WorkspaceToolBlockedError(
    "workspace_context_missing",
    [
      "No target repository is attached to this Eve run, so sandbox workspace tools are unavailable.",
      "Use the workspace context tool first, or report that repository context is missing instead of inspecting /workspace.",
    ].join(" "),
  );
}

function workspaceStateForRun(
  sessionId: string,
  runContext: ImpelEveRunContext,
): ImpelEveChannelState {
  const cacheKey = `${sessionId}:${workspaceRunContextKey(runContext)}`;
  const cached = workspaceStatesByKey.get(cacheKey);
  if (cached) return cached;

  const state = createImpelEveChannelState(runContext);
  workspaceStatesByKey.set(cacheKey, state);
  pruneWorkspaceCache();
  return state;
}

async function prepareWorkspaceState(
  state: ImpelEveChannelState,
  sandbox: SandboxSession,
): Promise<void> {
  try {
    await prepareImpelEveWorkspace(state, {
      getSandbox: async () => sandbox,
    });
  } catch (error) {
    throw new WorkspaceToolBlockedError(
      "workspace_prepare_failed",
      `Target repository context was present, but the Eve workspace could not be prepared: ${errorMessage(error)}.`,
    );
  }
}

async function assertWorkspaceRootExists(
  sandbox: SandboxSession,
): Promise<void> {
  await assertSandboxPathExists(
    sandbox,
    "/workspace",
    new WorkspaceToolBlockedError(
      "workspace_root_missing",
      "Prepared Eve workspace root /workspace is missing after workspace preparation.",
      ["/workspace"],
    ),
  );
}

async function assertWorkspaceToolInputIsValid(
  prepared: PreparedWorkspace,
  input: unknown,
  options: {
    mode: WorkspaceToolMode;
    toolName?: WorkspaceToolName;
  },
): Promise<void> {
  assertWriteModeAllowsTool(input, options);

  for (const workspacePath of requestedWorkspacePaths(input, options.toolName)) {
    await assertRequestedWorkspacePathExists(
      prepared,
      workspacePath,
      options.toolName,
    );
  }
}

function assertWriteModeAllowsTool(
  input: unknown,
  options: {
    mode: WorkspaceToolMode;
    toolName?: WorkspaceToolName;
  },
): void {
  if (options.toolName !== "write_file" || options.mode !== "read-only") return;

  throw new WorkspaceToolBlockedError(
    "workspace_read_only",
    "This workspace tool is read-only for this agent or specialist.",
    requestedWorkspacePaths(input, options.toolName),
  );
}

async function assertRequestedWorkspacePathExists(
  prepared: PreparedWorkspace,
  workspacePath: string,
  toolName?: WorkspaceToolName,
): Promise<void> {
  const normalizedPath = normalizeAllowedWorkspacePath(
    workspacePath,
    prepared,
    toolName,
  );
  const pathToCheck =
    toolName === "write_file" ? posix.dirname(normalizedPath) : normalizedPath;
  await assertSandboxPathExists(
    prepared.sandbox,
    pathToCheck,
    new WorkspaceToolBlockedError(
      "workspace_path_missing",
      `Requested ${toolName ?? "workspace"} path ${normalizedPath} does not exist in the prepared Eve workspace.`,
      [normalizedPath],
    ),
  );
}

function normalizeAllowedWorkspacePath(
  value: string,
  prepared: PreparedWorkspace,
  toolName?: WorkspaceToolName,
): string {
  const normalized = posix.normalize(value);
  assertInsideWorkspace(normalized, value, toolName);
  if (isAllowedPreparedWorkspacePath(normalized, prepared)) return normalized;

  throw new WorkspaceToolBlockedError(
    "workspace_path_outside_attached_repo",
    [
      `${toolName ?? "This tool"} requested ${normalized}, which is not one of the attached repository checkout paths.`,
      createImpelWorkspaceContextMessage(prepared.runContext) ??
        "No workspace context message is available.",
    ].join(" "),
    [normalized],
  );
}

function assertInsideWorkspace(
  normalized: string,
  original: string,
  toolName?: WorkspaceToolName,
): void {
  if (normalized === "/workspace" || normalized.startsWith("/workspace/")) return;

  throw new WorkspaceToolBlockedError(
    "workspace_path_outside_workspace",
    `${toolName ?? "This tool"} may only inspect attached repository paths under /workspace. Requested ${original}.`,
    [original],
  );
}

function isAllowedPreparedWorkspacePath(
  normalized: string,
  prepared: PreparedWorkspace,
): boolean {
  return (
    isWorkspaceMetadataPath(normalized) ||
    prepared.plannedRepos.some((repo) => pathIsInside(normalized, repo.path))
  );
}

function pathIsInside(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`);
}

function requestedWorkspacePaths(
  input: unknown,
  toolName?: WorkspaceToolName,
): string[] {
  const record = isRecord(input) ? input : emptyRecord;
  const readPaths = toolName
    ? workspacePathReaders[toolName]
    : readDefaultWorkspacePaths;
  return readPaths(record);
}

function readFileToolWorkspacePaths(
  record: Readonly<Record<string, unknown>>,
): string[] {
  return compactWorkspacePaths([
    readString(record.filePath),
    readString(record.path),
  ]);
}

function readSearchToolWorkspacePaths(
  record: Readonly<Record<string, unknown>>,
): string[] {
  return [readString(record.path) ?? "/workspace"];
}

function readDefaultWorkspacePaths(
  record: Readonly<Record<string, unknown>>,
): string[] {
  return compactWorkspacePaths([
    readString(record.filePath),
    readString(record.path),
  ]);
}

function compactWorkspacePaths(paths: readonly (string | undefined)[]): string[] {
  return paths.filter((path): path is string => path !== undefined);
}

function workspaceToolFailure(
  error: unknown,
  ctx: WorkspaceResolveContext,
  input: unknown,
  toolName?: WorkspaceToolName | "workspace",
): WorkspaceToolFailure {
  const runContext = workspaceFailureRunContext(ctx);
  const blocked = blockedWorkspaceToolError(error, input, toolName);

  return {
    ok: false,
    code: blocked.code,
    guidance: [
      "Do not guess /workspace paths.",
      "Use impel_workspace_context to get the verified checkout paths.",
      "If no repository context is attached, report that blocker instead of inspecting the agent runtime.",
    ],
    message: blocked.message,
    requestedPaths: uniqueWorkspacePaths([
      ...blocked.requestedPaths,
      ...requestedWorkspacePaths(input, concreteToolName(toolName)),
    ]),
    toolName: toolName ?? "workspace",
    workspaceContext: createImpelWorkspaceContextMessage(runContext ?? null),
  };
}

function workspaceFailureRunContext(
  ctx: WorkspaceResolveContext,
): ImpelEveRunContext | undefined {
  const runContext =
    rememberImpelWorkspaceRunContext(ctx) ??
    normalizeImpelEveRunContext(ctx.channel?.metadata);
  return runContext ?? undefined;
}

function blockedWorkspaceToolError(
  error: unknown,
  input: unknown,
  toolName?: WorkspaceToolName | "workspace",
): WorkspaceToolBlockedError {
  if (error instanceof WorkspaceToolBlockedError) return error;

  return new WorkspaceToolBlockedError(
    "workspace_tool_failed",
    errorMessage(error),
    requestedWorkspacePaths(input, concreteToolName(toolName)),
  );
}

function concreteToolName(
  toolName?: WorkspaceToolName | "workspace",
): WorkspaceToolName | undefined {
  return toolName === "workspace" ? undefined : toolName;
}

function uniqueWorkspacePaths(paths: readonly string[]): string[] {
  return Array.from(new Set(paths));
}

function workspaceRunContextKey(runContext: ImpelEveRunContext): string {
  return JSON.stringify({
    orgId: runContext.orgId,
    repos: runContext.repos,
    branch: runContext.branch,
    installationId: runContext.installationId,
    runId: runContext.runId,
    traceId: runContext.traceId,
  });
}

function pruneWorkspaceCache(): void {
  pruneMapToWorkspaceCacheLimit(workspaceStatesByKey);
  pruneMapToWorkspaceCacheLimit(runContextsBySessionId);
}

function pruneMapToWorkspaceCacheLimit(map: Map<string, unknown>): void {
  while (map.size > MAX_WORKSPACE_CACHE_ENTRIES) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) break;
    map.delete(oldestKey);
  }
}

function isWorkspaceMetadataPath(value: string): boolean {
  return (
    value === "/workspace/.impel" ||
    value.startsWith("/workspace/.impel/") ||
    value === "/workspace/README_IMPEL_WORKSPACE.md"
  );
}

function workspacePathsFromCommand(command: string): string[] {
  const matches = command.match(/\/workspace(?:\/[^\s'"`;<>()|&$\\]*)?/g) ?? [];
  return Array.from(
    new Set(matches.map((value) => value.replace(/[,.:\]}]+$/, ""))),
  );
}

async function assertSandboxPathExists(
  sandbox: SandboxSession,
  targetPath: string,
  error: WorkspaceToolBlockedError,
): Promise<void> {
  const result = await sandbox.run({
    command: `test -e ${shellQuote(targetPath)}`,
  });
  if (result.exitCode !== 0) throw error;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
