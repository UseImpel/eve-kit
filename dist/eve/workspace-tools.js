import path from "node:path";
import { defineBashTool, defineGlobTool, defineGrepTool, defineReadFileTool, defineTool, defineWriteFileTool, } from "eve/tools";
import { z } from "zod";
import { createImpelEveChannelState, createImpelWorkspaceContextMessage, normalizeImpelEveRunContext, planImpelEveRepoCheckouts, prepareImpelEveWorkspace, } from "./channel.js";
const posix = path.posix;
/**
 * Factory for an Eve `bash` tool that prepares the attached Impel workspace and
 * denies commands targeting paths outside verified `/workspace` checkouts.
 *
 * Usage: `export default defineImpelBashTool()`.
 */
export function defineImpelBashTool(options = {}) {
    return definePreparedWorkspaceTool(defineBashTool(), "bash", options);
}
/**
 * Factory for an Eve `glob` tool guarded to verified Impel workspace paths.
 *
 * Usage: `export default defineImpelGlobTool()`.
 */
export function defineImpelGlobTool(options = {}) {
    return definePreparedWorkspaceTool(defineGlobTool(), "glob", options);
}
/**
 * Factory for an Eve `grep` tool guarded to verified Impel workspace paths.
 *
 * Usage: `export default defineImpelGrepTool()`.
 */
export function defineImpelGrepTool(options = {}) {
    return definePreparedWorkspaceTool(defineGrepTool(), "grep", options);
}
/**
 * Factory for an Eve `read_file` tool guarded to verified Impel workspace paths.
 *
 * Usage: `export default defineImpelReadFileTool()`.
 */
export function defineImpelReadFileTool(options = {}) {
    return definePreparedWorkspaceTool(defineReadFileTool(), "read_file", options);
}
/**
 * Factory for an Eve `write_file` tool guarded to verified Impel workspace paths.
 *
 * Usage: `export default defineImpelWriteFileTool()`.
 */
export function defineImpelWriteFileTool(options = {}) {
    return definePreparedWorkspaceTool(defineWriteFileTool(), "write_file", options);
}
/**
 * Factory for the `impel_workspace_context` tool. It prepares the attached Eve
 * workspace and returns the verified repository checkout paths for other tools.
 *
 * Usage: `export default defineImpelWorkspaceContextTool()`.
 */
export function defineImpelWorkspaceContextTool(options = {}) {
    return defineTool({
        description: options.description ??
            "Prepare the attached Eve workspace and return the verified repository checkout paths. Use this before read_file, grep, glob, bash, or write_file.",
        inputSchema: z.object({}),
        async execute(_input, ctx) {
            return describePreparedImpelWorkspace(ctx);
        },
    });
}
const MAX_WORKSPACE_CACHE_ENTRIES = 500;
const runContextsBySessionId = new Map();
const workspaceStatesByKey = new Map();
const emptyRecord = {};
const workspacePathReaders = {
    bash: (record) => workspacePathsFromCommand(readString(record.command) ?? ""),
    glob: readSearchToolWorkspacePaths,
    grep: readSearchToolWorkspacePaths,
    read_file: readFileToolWorkspacePaths,
    write_file: readFileToolWorkspacePaths,
};
const defaultImpelWorkspaceToolGuidance = {
    bash: "Impel workspace wrapper: prepares attached repositories from Eve client context before execution. Do not target guessed /workspace paths; use impel_workspace_context for verified checkout paths.",
    glob: "Impel workspace wrapper: glob only verified attached repository paths. Use impel_workspace_context before broad searches.",
    grep: "Impel workspace wrapper: grep only verified attached repository paths. Use impel_workspace_context before broad searches.",
    read_file: "Impel workspace wrapper: read only verified attached repository paths. Use impel_workspace_context for the checkout map.",
    write_file: "Impel workspace wrapper: write only inside verified attached repository paths. Use impel_workspace_context for the checkout map.",
};
function definePreparedWorkspaceTool(tool, toolName, options) {
    const guidance = options.description ?? defaultImpelWorkspaceToolGuidance[toolName];
    return defineTool({
        ...tool,
        description: appendDescription(tool.description, guidance),
        async execute(input, ctx) {
            return runWithPreparedImpelWorkspace(tool, input, ctx, {
                mode: options.mode,
                toolName,
            });
        },
    });
}
function appendDescription(base, extra) {
    return extra ? [base, "", extra].join("\n") : base;
}
class WorkspaceToolBlockedError extends Error {
    code;
    requestedPaths;
    constructor(code, message, requestedPaths = []) {
        super(message);
        this.code = code;
        this.requestedPaths = requestedPaths;
        this.name = "WorkspaceToolBlockedError";
    }
}
export async function runWithPreparedImpelWorkspace(tool, input, ctx, options = {}) {
    const workspaceCtx = ctx;
    try {
        const prepared = await prepareImpelWorkspaceForTool(workspaceCtx);
        await assertWorkspaceToolInputIsValid(prepared, input, {
            mode: options.mode ?? "read-write",
            toolName: options.toolName,
        });
        return await tool.execute(input, ctx);
    }
    catch (error) {
        return workspaceToolFailure(error, workspaceCtx, input, options.toolName);
    }
}
export async function describePreparedImpelWorkspace(ctx) {
    const workspaceCtx = ctx;
    try {
        const prepared = await prepareImpelWorkspaceForTool(workspaceCtx);
        return {
            ok: true,
            layout: prepared.state.workspace.layout,
            message: createImpelWorkspaceContextMessage(prepared.runContext) ??
                "No Impel workspace context is attached.",
            repos: prepared.plannedRepos,
            workspacePrepared: prepared.state.workspace.prepared,
        };
    }
    catch (error) {
        return workspaceToolFailure(error, workspaceCtx, {}, "workspace");
    }
}
export function rememberImpelWorkspaceRunContext(ctx) {
    const runContext = normalizeImpelEveRunContext(ctx.channel?.metadata);
    if (runContext?.repos?.length) {
        rememberImpelWorkspaceRunContextForSession(ctx.session.id, runContext);
        return runContext;
    }
    return runContextsBySessionId.get(ctx.session.id);
}
function rememberImpelWorkspaceRunContextForSession(sessionId, runContext) {
    runContextsBySessionId.set(sessionId, runContext);
    pruneWorkspaceCache();
}
async function prepareImpelWorkspaceForTool(ctx) {
    const sandbox = await ctx.getSandbox();
    const restored = await preparedWorkspaceFromSandboxMetadata(ctx.session.id, sandbox);
    if (restored)
        return restored;
    // A subagent spawned via the built-in `agent` tool shares the parent's
    // sandbox but runs in its OWN session with no clientContext repos, so
    // channel/session resolution finds nothing. Recover the parent's repos +
    // checkout auth from the shared-sandbox run-context marker and prepare this
    // run's own view (idempotent clone into the shared /workspace). This is what
    // lets delegated repo work actually reach the files.
    const runContext = rememberImpelWorkspaceRunContext(ctx) ??
        (await recoverRunContextFromSandboxMarker(sandbox));
    if (!runContext?.repos?.length) {
        throw new WorkspaceToolBlockedError("workspace_context_missing", [
            "No target repository is attached to this Eve run, so sandbox workspace tools are unavailable.",
            "Use the workspace context tool first, or report that repository context is missing instead of inspecting /workspace.",
        ].join(" "));
    }
    rememberImpelWorkspaceRunContextForSession(ctx.session.id, runContext);
    const state = workspaceStateForRun(ctx.session.id, runContext);
    await prepareWorkspaceState(state, sandbox);
    const plannedRepos = planImpelEveRepoCheckouts(runContext.repos ?? []);
    await assertWorkspaceRootExists(sandbox);
    return { sandbox, runContext, state, plannedRepos };
}
/**
 * Recover the run-context (repos + checkout auth) from the shared-sandbox
 * marker `/workspace/.impel/run-context.json` — written by the parent's
 * workspace prep (eagerly, before its own clone). Unlike
 * preparedWorkspaceFromSandboxMetadata this does NOT require the workspace to
 * be checked out: it returns just enough (repo names, branch, installationId)
 * for THIS run to clone its own view. Used only as the last fallback before a
 * co-resident subagent would otherwise be told "no repository attached".
 */
async function recoverRunContextFromSandboxMarker(sandbox) {
    const raw = await readPreparedWorkspaceMetadataJson(sandbox);
    if (!isRecord(raw))
        return undefined;
    const repoNames = Array.isArray(raw.repos)
        ? raw.repos
            .map((entry) => (isRecord(entry) ? readString(entry.repo) : undefined))
            .filter((name) => Boolean(name))
        : [];
    if (repoNames.length === 0)
        return undefined;
    const runContext = { repos: repoNames };
    copyStringProperty(runContext, "orgId", readString(raw.orgId));
    copyStringProperty(runContext, "branch", readString(raw.branch));
    copyStringProperty(runContext, "runId", readString(raw.runId));
    copyStringProperty(runContext, "traceId", readString(raw.traceId));
    copyStringProperty(runContext, "githubConnectorUid", readString(raw.githubConnectorUid));
    if (typeof raw.installationId === "string" ||
        typeof raw.installationId === "number") {
        runContext.installationId = raw.installationId;
    }
    const codeContext = normalizeImpelEveRunContext({
        codeIntelligence: raw.codeIntelligence,
    })?.codeIntelligence;
    if (codeContext)
        runContext.codeIntelligence = codeContext;
    return runContext;
}
async function preparedWorkspaceFromSandboxMetadata(sessionId, sandbox) {
    const metadata = await readPreparedWorkspaceMetadata(sandbox);
    if (!metadata)
        return undefined;
    const runContext = runContextFromPreparedWorkspaceMetadata(metadata);
    rememberImpelWorkspaceRunContextForSession(sessionId, runContext);
    const plannedRepos = plannedReposFromPreparedWorkspaceMetadata(metadata);
    const state = stateFromPreparedWorkspaceMetadata(sandbox, runContext, metadata);
    await assertWorkspaceRootExists(sandbox);
    return { sandbox, runContext, state, plannedRepos };
}
async function readPreparedWorkspaceMetadata(sandbox) {
    const raw = await readPreparedWorkspaceMetadataJson(sandbox);
    return raw ? parsePreparedWorkspaceMetadata(raw) : undefined;
}
async function readPreparedWorkspaceMetadataJson(sandbox) {
    try {
        const result = await sandbox.run({
            command: "cat /workspace/.impel/run-context.json",
        });
        const raw = successfulSandboxStdout(result);
        return raw ? JSON.parse(raw) : undefined;
    }
    catch {
        return undefined;
    }
}
function successfulSandboxStdout(result) {
    if (result.exitCode !== 0)
        return undefined;
    return readString(String(result.stdout ?? ""));
}
function parsePreparedWorkspaceMetadata(value) {
    const fields = readWorkspaceMetadataFields(value);
    if (!fields)
        return undefined;
    return {
        layout: fields.layout,
        workspaceRoot: "/workspace",
        repos: fields.repos,
        ...(normalizeImpelEveRunContext({
            codeIntelligence: fields.source.codeIntelligence,
        })?.codeIntelligence
            ? {
                codeIntelligence: normalizeImpelEveRunContext({
                    codeIntelligence: fields.source.codeIntelligence,
                }).codeIntelligence,
            }
            : {}),
        ...readOptionalWorkspaceMetadataStrings(fields.source),
    };
}
function readWorkspaceMetadataFields(value) {
    if (!isRecord(value))
        return undefined;
    const layout = readWorkspaceMetadataLayout(value);
    const repos = readPreparedWorkspaceRepos(value.repos);
    return layout && repos.length > 0
        ? { source: value, layout, repos }
        : undefined;
}
function readWorkspaceMetadataLayout(value) {
    return readString(value.workspaceRoot) === "/workspace"
        ? readWorkspaceLayout(value.layout)
        : undefined;
}
function readPreparedWorkspaceRepos(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map(readPreparedWorkspaceRepo)
        .filter((repo) => repo !== undefined);
}
function readOptionalWorkspaceMetadataStrings(record) {
    return {
        ...optionalStringProperty("orgId", record.orgId),
        ...optionalStringProperty("runId", record.runId),
        ...optionalStringProperty("traceId", record.traceId),
        ...optionalStringProperty("branch", record.branch),
    };
}
function runContextFromPreparedWorkspaceMetadata(metadata) {
    const runContext = {
        repos: metadata.repos.map((repo) => repo.repo),
    };
    copyStringProperty(runContext, "orgId", metadata.orgId);
    copyStringProperty(runContext, "branch", metadata.branch);
    copyStringProperty(runContext, "runId", metadata.runId);
    copyStringProperty(runContext, "traceId", metadata.traceId);
    if (typeof metadata.installationId === "string" ||
        typeof metadata.installationId === "number") {
        runContext.installationId = metadata.installationId;
    }
    copyStringProperty(runContext, "githubConnectorUid", metadata.githubConnectorUid);
    if (metadata.codeIntelligence) {
        runContext.codeIntelligence = metadata.codeIntelligence;
    }
    return runContext;
}
function plannedReposFromPreparedWorkspaceMetadata(metadata) {
    return metadata.repos.map((repo, index) => ({
        repo: repo.repo,
        path: repo.path,
        role: index === 0 ? "primary" : "additional",
    }));
}
function stateFromPreparedWorkspaceMetadata(sandbox, runContext, metadata) {
    return {
        runContext,
        workspaceAuth: { identityRunToken: null },
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
function readPreparedWorkspaceRepo(value) {
    if (!isRecord(value))
        return undefined;
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
function readWorkspaceLayout(value) {
    return value === "single-repo-root" || value === "multi-repo-directory"
        ? value
        : undefined;
}
function optionalStringProperty(key, value) {
    const stringValue = readString(value);
    return stringValue
        ? { [key]: stringValue }
        : {};
}
function copyStringProperty(target, key, value) {
    if (typeof value === "string") {
        target[key] = value;
    }
}
function readRequiredStringFields(record, keys) {
    const entries = keys.map((key) => [key, readString(record[key])]);
    if (entries.some(([, value]) => value === undefined))
        return undefined;
    return Object.fromEntries(entries);
}
function requireImpelWorkspaceRunContext(ctx) {
    const runContext = rememberImpelWorkspaceRunContext(ctx);
    if (runContext?.repos?.length)
        return runContext;
    throw new WorkspaceToolBlockedError("workspace_context_missing", [
        "No target repository is attached to this Eve run, so sandbox workspace tools are unavailable.",
        "Use the workspace context tool first, or report that repository context is missing instead of inspecting /workspace.",
    ].join(" "));
}
function workspaceStateForRun(sessionId, runContext) {
    const cacheKey = `${sessionId}:${workspaceRunContextKey(runContext)}`;
    const cached = workspaceStatesByKey.get(cacheKey);
    if (cached)
        return cached;
    const state = createImpelEveChannelState(runContext);
    workspaceStatesByKey.set(cacheKey, state);
    pruneWorkspaceCache();
    return state;
}
async function prepareWorkspaceState(state, sandbox) {
    try {
        await prepareImpelEveWorkspace(state, {
            getSandbox: async () => sandbox,
        });
    }
    catch (error) {
        throw new WorkspaceToolBlockedError("workspace_prepare_failed", `Target repository context was present, but the Eve workspace could not be prepared: ${errorMessage(error)}.`);
    }
}
async function assertWorkspaceRootExists(sandbox) {
    await assertSandboxPathExists(sandbox, "/workspace", new WorkspaceToolBlockedError("workspace_root_missing", "Prepared Eve workspace root /workspace is missing after workspace preparation.", ["/workspace"]));
}
async function assertWorkspaceToolInputIsValid(prepared, input, options) {
    assertWriteModeAllowsTool(input, options);
    for (const workspacePath of requestedWorkspacePaths(input, options.toolName)) {
        await assertRequestedWorkspacePathExists(prepared, workspacePath, options.toolName);
    }
}
function assertWriteModeAllowsTool(input, options) {
    if (options.toolName !== "write_file" || options.mode !== "read-only")
        return;
    throw new WorkspaceToolBlockedError("workspace_read_only", "This workspace tool is read-only for this agent or specialist.", requestedWorkspacePaths(input, options.toolName));
}
async function assertRequestedWorkspacePathExists(prepared, workspacePath, toolName) {
    const normalizedPath = normalizeAllowedWorkspacePath(workspacePath, prepared, toolName);
    const pathToCheck = toolName === "write_file" ? posix.dirname(normalizedPath) : normalizedPath;
    await assertSandboxPathExists(prepared.sandbox, pathToCheck, new WorkspaceToolBlockedError("workspace_path_missing", `Requested ${toolName ?? "workspace"} path ${normalizedPath} does not exist in the prepared Eve workspace.`, [normalizedPath]));
}
function normalizeAllowedWorkspacePath(value, prepared, toolName) {
    const normalized = posix.normalize(value);
    assertInsideWorkspace(normalized, value, toolName);
    if (isAllowedPreparedWorkspacePath(normalized, prepared))
        return normalized;
    throw new WorkspaceToolBlockedError("workspace_path_outside_attached_repo", [
        `${toolName ?? "This tool"} requested ${normalized}, which is not one of the attached repository checkout paths.`,
        createImpelWorkspaceContextMessage(prepared.runContext) ??
            "No workspace context message is available.",
    ].join(" "), [normalized]);
}
function assertInsideWorkspace(normalized, original, toolName) {
    if (normalized === "/workspace" || normalized.startsWith("/workspace/"))
        return;
    throw new WorkspaceToolBlockedError("workspace_path_outside_workspace", `${toolName ?? "This tool"} may only inspect attached repository paths under /workspace. Requested ${original}.`, [original]);
}
function isAllowedPreparedWorkspacePath(normalized, prepared) {
    return (isWorkspaceMetadataPath(normalized) ||
        prepared.plannedRepos.some((repo) => pathIsInside(normalized, repo.path)));
}
function pathIsInside(candidate, root) {
    return candidate === root || candidate.startsWith(`${root}/`);
}
function requestedWorkspacePaths(input, toolName) {
    const record = isRecord(input) ? input : emptyRecord;
    const readPaths = toolName
        ? workspacePathReaders[toolName]
        : readDefaultWorkspacePaths;
    return readPaths(record);
}
function readFileToolWorkspacePaths(record) {
    return compactWorkspacePaths([
        readString(record.filePath),
        readString(record.path),
    ]);
}
function readSearchToolWorkspacePaths(record) {
    return [readString(record.path) ?? "/workspace"];
}
function readDefaultWorkspacePaths(record) {
    return compactWorkspacePaths([
        readString(record.filePath),
        readString(record.path),
    ]);
}
function compactWorkspacePaths(paths) {
    return paths.filter((path) => path !== undefined);
}
function workspaceToolFailure(error, ctx, input, toolName) {
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
function workspaceFailureRunContext(ctx) {
    const runContext = rememberImpelWorkspaceRunContext(ctx) ??
        normalizeImpelEveRunContext(ctx.channel?.metadata);
    return runContext ?? undefined;
}
function blockedWorkspaceToolError(error, input, toolName) {
    if (error instanceof WorkspaceToolBlockedError)
        return error;
    return new WorkspaceToolBlockedError("workspace_tool_failed", errorMessage(error), requestedWorkspacePaths(input, concreteToolName(toolName)));
}
function concreteToolName(toolName) {
    return toolName === "workspace" ? undefined : toolName;
}
function uniqueWorkspacePaths(paths) {
    return Array.from(new Set(paths));
}
function workspaceRunContextKey(runContext) {
    return JSON.stringify({
        orgId: runContext.orgId,
        repos: runContext.repos,
        branch: runContext.branch,
        installationId: runContext.installationId,
        runId: runContext.runId,
        traceId: runContext.traceId,
        codeIntelligenceWorkspaceId: runContext.codeIntelligence?.workspaceId,
    });
}
function pruneWorkspaceCache() {
    pruneMapToWorkspaceCacheLimit(workspaceStatesByKey);
    pruneMapToWorkspaceCacheLimit(runContextsBySessionId);
}
function pruneMapToWorkspaceCacheLimit(map) {
    while (map.size > MAX_WORKSPACE_CACHE_ENTRIES) {
        const oldestKey = map.keys().next().value;
        if (oldestKey === undefined)
            break;
        map.delete(oldestKey);
    }
}
function isWorkspaceMetadataPath(value) {
    return (value === "/workspace/.impel" ||
        value.startsWith("/workspace/.impel/") ||
        value === "/workspace/README_IMPEL_WORKSPACE.md");
}
function workspacePathsFromCommand(command) {
    const matches = command.match(/\/workspace(?:\/[^\s'"`;<>()|&$\\]*)?/g) ?? [];
    return Array.from(new Set(matches.map((value) => value.replace(/[,.:\]}]+$/, ""))));
}
async function assertSandboxPathExists(sandbox, targetPath, error) {
    const result = await sandbox.run({
        command: `test -e ${shellQuote(targetPath)}`,
    });
    if (result.exitCode !== 0)
        throw error;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function readString(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function shellQuote(value) {
    return `'${value.replaceAll("'", "'\\''")}'`;
}
//# sourceMappingURL=workspace-tools.js.map