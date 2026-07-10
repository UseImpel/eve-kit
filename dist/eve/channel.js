import { createSign } from "node:crypto";
import { defineChannel, GET, POST, } from "eve/channels";
import { eveChannel } from "eve/channels/eve";
import { httpBasic, localDev, placeholderAuth, routeAuth, vercelOidc, } from "eve/channels/auth";
/** Safe, token-free failure from the centralized impel-identity resolver. */
export class ImpelIdentityResolveError extends Error {
    code;
    status;
    constructor(options) {
        super(options.message);
        this.name = "ImpelIdentityResolveError";
        this.code = options.code;
        this.status = options.status;
    }
}
const DEFAULT_GITHUB_CONNECTOR_UID = "github/useimpel-github";
const EVE_SESSION_ID_HEADER = "x-eve-session-id";
const EVE_MESSAGE_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";
export function defaultImpelEveChannel({ basicUser = process.env.EVE_APP_BASIC_USER ??
    process.env.IMPEL_EVE_BASIC_USER, basicPassword = process.env.EVE_APP_BASIC_PASSWORD ??
    process.env.IMPEL_EVE_BASIC_PASSWORD, includePlaceholderAuth = false, prepareAttachedRepos = true, checkoutDepth = readCheckoutDepthFromEnv(), trustedVercelSubjects, referenceRepos, } = {}) {
    const basic = basicUser && basicPassword
        ? [httpBasic({ username: basicUser, password: basicPassword })]
        : [];
    const auth = [
        localDev(),
        vercelOidc(trustedVercelSubjects?.length
            ? { subjects: trustedVercelSubjects }
            : undefined),
        ...basic,
        ...(includePlaceholderAuth ? [placeholderAuth()] : []),
    ];
    return defineChannel({
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
                if (!prepareAttachedRepos)
                    return;
                await prepareImpelEveWorkspace(channel.state, {
                    checkoutDepth,
                    referenceRepos,
                    getSandbox: () => ctx.getSandbox(),
                });
            },
        },
    });
}
export function createImpelEveChannelState(runContext, workspaceAuth) {
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
export async function extractImpelEveRunContextFromRequest(request) {
    if (request.method !== "POST")
        return null;
    let body;
    try {
        body = await request.clone().json();
    }
    catch {
        return null;
    }
    if (!isRecord(body))
        return null;
    return normalizeImpelEveRunContext(body.clientContext);
}
// Reads the gateway token without ever treating it as an identity assertion.
export function readClientContextRunToken(value) {
    if (!isRecord(value))
        return null;
    return typeof value.runToken === "string" && value.runToken.length > 0
        ? value.runToken
        : null;
}
// Reads the dedicated v1 server assertion for workspace identity resolution.
// Older callers may reuse runToken only when it is itself v1 and the dedicated
// field is absent. A gateway-audience v2 token is never sent to identity.
export function readClientContextIdentityRunToken(value) {
    if (!isRecord(value))
        return null;
    if (Object.prototype.hasOwnProperty.call(value, "identityRunToken")) {
        return readString(value.identityRunToken) ?? null;
    }
    return readV1RunToken(value.runToken);
}
function readWorkspaceIdentityRunToken(value) {
    if (!value)
        return null;
    if (Object.prototype.hasOwnProperty.call(value, "identityRunToken")) {
        return readString(value.identityRunToken) ?? null;
    }
    return readV1RunToken(value.runToken);
}
// clientContext.runToken and identityRunToken are deliberately NOT part of the
// typed channel context: the raw clientContext sentinel
// (normalizeClientContextMessages) is the sole carrier to the gateway wrapper,
// keeping both credentials out of channel metadata() and workspace keys.
export function normalizeImpelEveRunContext(value) {
    if (!isRecord(value))
        return null;
    const repos = Array.isArray(value.repos)
        ? value.repos
            .filter((repo) => typeof repo === "string")
            .map((repo) => repo.trim())
            .filter(Boolean)
        : undefined;
    return stripUndefined({
        orgId: readString(value.orgId),
        repos: repos && repos.length > 0 ? Array.from(new Set(repos)) : undefined,
        branch: readString(value.branch),
        installationId: typeof value.installationId === "string" ||
            typeof value.installationId === "number"
            ? value.installationId
            : undefined,
        githubConnectorUid: readString(value.githubConnectorUid),
        runId: readString(value.runId),
        traceId: readString(value.traceId),
        agent: isRecord(value.agent) ? value.agent : undefined,
        btParent: readString(value.btParent),
        workspaceSeed: parseWorkspaceSeed(value.workspaceSeed),
    });
}
// Defensive parse of the Phase 2 inline workspace seed. Returns undefined unless
// it carries a non-empty agentId and at least one { path, content } file.
function parseWorkspaceSeed(value) {
    if (!isRecord(value))
        return undefined;
    const agentId = readString(value.agentId);
    if (!agentId || !Array.isArray(value.files))
        return undefined;
    const files = [];
    for (const entry of value.files) {
        if (!isRecord(entry))
            continue;
        const path = readString(entry.path);
        if (!path || typeof entry.content !== "string")
            continue;
        const enc = entry.enc === "base64" ? "base64" : "utf8";
        files.push({ path, content: entry.content, enc });
    }
    return files.length > 0 ? { agentId, files } : undefined;
}
export function normalizeClientContextMessages(value) {
    if (value === undefined)
        return undefined;
    if (typeof value === "string") {
        return value.length > 0 ? [toClientContextMessage(value)] : undefined;
    }
    if (Array.isArray(value)) {
        if (value.length === 0)
            return undefined;
        if (!value.every((item) => typeof item === "string" && item.length > 0)) {
            throw new Error("Expected 'clientContext' array entries to be non-empty strings.");
        }
        return value.map((item) => toClientContextMessage(item));
    }
    if (!isRecord(value)) {
        throw new Error("Expected 'clientContext' to be a string, string array, or JSON object.");
    }
    return [
        toClientContextMessage(JSON.stringify(assertJsonSerializable(value))),
    ];
}
function toClientContextMessage(value) {
    return `Client context:\n${value}`;
}
export async function prepareImpelEveWorkspace(state, options) {
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
                await materializeWorkspaceSeed(await options.getSandbox(), runContext.workspaceSeed);
            }
            catch {
                // best-effort — model falls back to the snapshot.
            }
        }
        return;
    }
    const sandbox = await options.getSandbox();
    const checkoutPlan = createWorkspaceCheckoutPlan(runContext.repos);
    const checkoutDepth = options.checkoutDepth ?? readCheckoutDepthFromEnv();
    const workspaceKey = createWorkspaceKey(runContext, {
        checkoutDepth,
        layout: checkoutPlan.layout,
        repos: checkoutPlan.repos,
    });
    if (state.workspace.prepared &&
        state.workspace.sandboxId === sandbox.id &&
        state.workspace.key === workspaceKey) {
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
        const prepared = [];
        for (const planned of checkoutPlan.repos) {
            const checkout = await checkoutGitHubRepository(sandbox, planned.repoRef, {
                depth: checkoutDepth,
                path: planned.path,
                ref: runContext.branch ?? "HEAD",
            });
            prepared.push(checkout);
        }
        await writeWorkspaceMetadata(sandbox, runContext, prepared, checkoutPlan.layout);
        state.workspace = {
            prepared: true,
            sandboxId: sandbox.id,
            key: workspaceKey,
            layout: checkoutPlan.layout,
            repos: prepared,
            error: null,
        };
    }
    catch (error) {
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
        await writeCheckoutFailureMarker(sandbox, message).catch(() => { });
        throw error;
    }
}
// Phase 2 [UNVERIFIED]: write inline seed files into /workspace/agents/<id>/ so
// the model reads the real, UNTRUNCATED draft bundle. Path traversal is stripped
// so a seed can only ever land under the agent root. Content rides the shell as
// base64 (utf8 seeds are re-encoded) so any bytes survive.
async function materializeWorkspaceSeed(sandbox, seed) {
    const root = `/workspace/agents/${safeSeedSegment(seed.agentId)}`;
    await sandbox.run({ command: `mkdir -p '${root}'` });
    for (const file of seed.files) {
        const rel = normalizeSeedPath(file.path);
        if (!rel)
            continue;
        const abs = `${root}/${rel}`;
        const dir = abs.slice(0, abs.lastIndexOf("/"));
        const b64 = file.enc === "base64"
            ? file.content.replace(/[^A-Za-z0-9+/=]/g, "")
            : Buffer.from(file.content, "utf8").toString("base64");
        await sandbox.run({
            command: `mkdir -p '${dir}' && printf '%s' '${b64}' | base64 -d > '${abs}'`,
        });
    }
}
function safeSeedSegment(value) {
    return value.replace(/[^A-Za-z0-9._-]/g, "-") || "agent";
}
// Strip leading slashes, `.` and `..` so a seed path only lands under the root.
function normalizeSeedPath(path) {
    const parts = path
        .split("/")
        .map((segment) => segment.trim())
        .filter((segment) => segment && segment !== "." && segment !== "..");
    return parts.length ? parts.join("/") : null;
}
/** Best-effort `/workspace/CHECKOUT_FAILED.md` so `ls /workspace` tells the
 * story even when the failure event itself never reaches the run. */
async function writeCheckoutFailureMarker(sandbox, message) {
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
function normalizeReferenceRepos(referenceRepos) {
    const names = new Set();
    for (const entry of referenceRepos ?? []) {
        const trimmed = entry.trim();
        if (trimmed)
            names.add(trimmed);
    }
    return Array.from(names);
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
async function prepareReferenceRepoAccess(state, runContext, referenceRepos, options) {
    const sandbox = await options.getSandbox();
    const workspaceKey = `reference:${referenceRepos.slice().sort().join(",")}`;
    if (state.workspace.prepared &&
        state.workspace.sandboxId === sandbox.id &&
        state.workspace.key === workspaceKey) {
        return;
    }
    try {
        // Scope the brokered token to the reference repos only (least privilege).
        const referenceRunContext = {
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
    }
    catch (error) {
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
function createImpelEveRoutes(auth) {
    return [
        createImpelEveInfoRoute(auth),
        POST("/eve/v1/session", async (request, args) => {
            const authorized = await routeAuth(request, auth);
            if (authorized instanceof Response)
                return authorized;
            const body = await parseJsonBody(request);
            if (body instanceof Response)
                return body;
            const parsed = parseCreateSessionBody(body);
            if (parsed instanceof Response)
                return parsed;
            const state = createImpelEveChannelState(normalizeImpelEveRunContext(parsed.clientContext), {
                identityRunToken: readClientContextIdentityRunToken(parsed.clientContext),
            });
            const session = await args.send(createSendPayload(parsed), withState({
                auth: authorized,
                continuationToken: `eve:${crypto.randomUUID()}`,
                mode: parsed.mode,
            }, state));
            return Response.json({
                continuationToken: session.continuationToken,
                ok: true,
                sessionId: session.id,
            }, {
                headers: {
                    "cache-control": "no-store",
                    [EVE_SESSION_ID_HEADER]: session.id,
                },
                status: 202,
            });
        }),
        POST("/eve/v1/session/:sessionId", async (request, args) => {
            const authorized = await routeAuth(request, auth);
            if (authorized instanceof Response)
                return authorized;
            const sessionId = args.params.sessionId;
            if (!sessionId) {
                return jsonError("Missing session id.", 400);
            }
            try {
                args.getSession(sessionId);
            }
            catch {
                return jsonError("Session not found.", 404);
            }
            const body = await parseJsonBody(request);
            if (body instanceof Response)
                return body;
            const parsed = parseContinueSessionBody(body);
            if (parsed instanceof Response)
                return parsed;
            const state = createImpelEveChannelState(normalizeImpelEveRunContext(parsed.clientContext), {
                identityRunToken: readClientContextIdentityRunToken(parsed.clientContext),
            });
            const session = await args.send(createSendPayload(parsed), withState({
                auth: authorized,
                continuationToken: parsed.continuationToken,
            }, state));
            return Response.json({
                ok: true,
                sessionId: session.id,
            }, {
                headers: {
                    "cache-control": "no-store",
                    [EVE_SESSION_ID_HEADER]: session.id,
                },
                status: 200,
            });
        }),
        GET("/eve/v1/session/:sessionId/stream", async (request, args) => {
            const authorized = await routeAuth(request, auth);
            if (authorized instanceof Response)
                return authorized;
            const sessionId = args.params.sessionId;
            if (!sessionId) {
                return jsonError("Missing session id.", 400);
            }
            const startIndex = parseStartIndex(request);
            if (startIndex instanceof Response)
                return startIndex;
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
            }
            catch {
                return jsonError("Session not found.", 404);
            }
        }),
    ];
}
function createImpelEveInfoRoute(auth) {
    const route = eveChannel({ auth }).routes.find((candidate) => candidate.method === "GET" && candidate.path === "/eve/v1/info");
    if (!route || route.transport === "websocket") {
        throw new Error("Eve's standard agent info route is unavailable.");
    }
    // Reuse Eve's own authenticated info handler so its internal Nitro dispatch
    // context and response schema stay version-aligned. The handler never sends
    // a session, so adapting its stateless RouteHandlerArgs to this stateful
    // channel is safe; the original runtime args object is passed through.
    return GET("/eve/v1/info", (request, args) => route.handler(request, args));
}
async function parseJsonBody(request) {
    let body;
    try {
        body = await request.json();
    }
    catch {
        return jsonError("Invalid JSON body.", 400);
    }
    if (!isRecord(body))
        return jsonError("Expected a JSON object.", 400);
    return body;
}
function parseCreateSessionBody(body) {
    const message = parseMessageField(body.message);
    if (message instanceof Response)
        return message;
    if (message === undefined) {
        return jsonError("Missing or empty 'message' field.", 400);
    }
    const context = parseClientContextField(body.clientContext);
    if (context instanceof Response)
        return context;
    const mode = parseModeField(body.mode);
    if (mode instanceof Response)
        return mode;
    const outputSchema = parseOutputSchemaField(body.outputSchema);
    if (outputSchema instanceof Response)
        return outputSchema;
    return stripUndefined({
        clientContext: body.clientContext,
        context,
        message,
        mode,
        outputSchema,
    });
}
function parseContinueSessionBody(body) {
    const continuationToken = typeof body.continuationToken === "string" &&
        body.continuationToken.length > 0
        ? body.continuationToken
        : undefined;
    if (!continuationToken) {
        return jsonError("Missing or empty 'continuationToken' field.", 400);
    }
    const message = parseMessageField(body.message);
    if (message instanceof Response)
        return message;
    const inputResponses = parseInputResponsesField(body.inputResponses);
    if (inputResponses instanceof Response)
        return inputResponses;
    if (message === undefined && inputResponses === undefined) {
        return jsonError("Expected a non-empty 'message', a non-empty 'inputResponses' array, or both.", 400);
    }
    const context = parseClientContextField(body.clientContext);
    if (context instanceof Response)
        return context;
    const outputSchema = parseOutputSchemaField(body.outputSchema);
    if (outputSchema instanceof Response)
        return outputSchema;
    return stripUndefined({
        clientContext: body.clientContext,
        context,
        continuationToken,
        inputResponses,
        message,
        outputSchema,
    });
}
function parseMessageField(value) {
    if (value === undefined)
        return undefined;
    if (typeof value === "string")
        return value.length > 0 ? value : undefined;
    if (!Array.isArray(value)) {
        return jsonError("Expected 'message' to be a string or an array of text/file parts.", 400);
    }
    if (value.length === 0)
        return undefined;
    return value;
}
function parseClientContextField(value) {
    try {
        return withWorkspaceContextMessages(value, normalizeClientContextMessages(value));
    }
    catch (error) {
        return jsonError(error instanceof Error ? error.message : String(error), 400);
    }
}
function withWorkspaceContextMessages(clientContext, messages) {
    const workspaceContext = createImpelWorkspaceContextMessage(normalizeImpelEveRunContextFromClientContext(clientContext));
    if (!workspaceContext)
        return messages;
    return [...(messages ?? []), workspaceContext];
}
function normalizeImpelEveRunContextFromClientContext(value) {
    const direct = normalizeImpelEveRunContext(value);
    if (direct)
        return direct;
    if (typeof value !== "string" || value.trim() === "")
        return null;
    try {
        return normalizeImpelEveRunContext(JSON.parse(value));
    }
    catch {
        return null;
    }
}
function parseInputResponsesField(value) {
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value) || value.length === 0) {
        return jsonError("Expected 'inputResponses' to be a non-empty array.", 400);
    }
    return value;
}
function parseModeField(value) {
    if (value === undefined)
        return undefined;
    if (value === "conversation" || value === "task")
        return value;
    return jsonError("Expected 'mode' to be either 'conversation' or 'task'.", 400);
}
function parseOutputSchemaField(value) {
    if (value === undefined)
        return undefined;
    if (!isRecord(value)) {
        return jsonError("Expected 'outputSchema' to be a JSON object.", 400);
    }
    try {
        return assertJsonSerializable(value);
    }
    catch (error) {
        return jsonError(error instanceof Error ? error.message : String(error), 400);
    }
}
function createSendPayload(input) {
    if (input.message !== undefined &&
        input.context === undefined &&
        input.outputSchema === undefined &&
        input.inputResponses === undefined) {
        return input.message;
    }
    return stripUndefined({
        context: input.context,
        inputResponses: input.inputResponses,
        message: input.message,
        outputSchema: input.outputSchema,
    });
}
function withState(options, state) {
    return {
        ...options,
        state,
    };
}
function parseStartIndex(request) {
    const value = new URL(request.url).searchParams.get("startIndex");
    if (value === null)
        return undefined;
    const startIndex = Number.parseInt(value, 10);
    if (!Number.isSafeInteger(startIndex) || startIndex < 0) {
        return jsonError("Expected startIndex to be a non-negative integer.", 400);
    }
    return startIndex;
}
function serializeAsNdjson(stream) {
    const encoder = new TextEncoder();
    return stream.pipeThrough(new TransformStream({
        transform(event, controller) {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        },
    }));
}
function jsonError(error, status) {
    return Response.json({
        error,
        ok: false,
    }, { status });
}
function assertJsonSerializable(value) {
    return JSON.parse(JSON.stringify(value));
}
export function planImpelEveRepoCheckouts(repoNames) {
    return createWorkspaceCheckoutPlan(repoNames).repos.map((repo) => ({
        repo: repo.repo,
        path: repo.path,
        role: repo.role,
    }));
}
export function createImpelWorkspaceContextMessage(runContext) {
    if (!runContext?.repos?.length)
        return undefined;
    const plan = createWorkspaceCheckoutPlan(runContext.repos);
    const lines = [
        "Impel workspace context:",
        `- Layout: ${plan.layout}`,
        "- The Eve sandbox command working directory is /workspace.",
    ];
    if (plan.layout === "multi-repo-directory") {
        lines.push("- /workspace is a coordination directory, not a git checkout.", "- The attached repositories are already cloned at these paths:");
    }
    else {
        lines.push("- The attached repository is already cloned at this path:");
    }
    for (const repo of plan.repos) {
        lines.push(`  - ${repo.repo}: ${repo.path}`);
    }
    lines.push("- Use git commands against the listed paths, for example: git -C <path> rev-list --count HEAD.", "- Do not ask the user for repo paths or GitHub tokens before checking these workspace paths.", "- Workspace metadata is also available at /workspace/.impel/run-context.json and /workspace/README_IMPEL_WORKSPACE.md.");
    return lines.join("\n");
}
function createWorkspaceCheckoutPlan(repoNames) {
    const repoRefs = repoNames.map(parseGitHubRepo);
    const layout = repoRefs.length <= 1 ? "single-repo-root" : "multi-repo-directory";
    const repoNameCounts = countRepoNames(repoRefs);
    return {
        layout,
        repos: repoRefs.map((repoRef, index) => ({
            repo: repoRef.fullName,
            repoRef,
            path: layout === "single-repo-root"
                ? "/workspace"
                : `/workspace/${checkoutDirectoryName(repoRef, repoNameCounts)}`,
            role: index === 0 ? "primary" : "additional",
        })),
    };
}
function countRepoNames(repoRefs) {
    const counts = new Map();
    for (const repo of repoRefs) {
        counts.set(repo.repo, (counts.get(repo.repo) ?? 0) + 1);
    }
    return counts;
}
function checkoutDirectoryName(repo, repoNameCounts) {
    if ((repoNameCounts.get(repo.repo) ?? 0) === 1) {
        return safePathSegment(repo.repo);
    }
    return safePathSegment(repo.fullName);
}
function createWorkspaceKey(runContext, plan) {
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
async function prepareWorkspaceRoot(sandbox, layout) {
    if (layout === "single-repo-root") {
        await runSandboxCommand(sandbox, "prepare single-repo workspace root", "mkdir -p /workspace");
        return;
    }
    await runSandboxCommand(sandbox, "prepare multi-repo workspace root", [
        "mkdir -p /workspace",
        "find /workspace -mindepth 1 -maxdepth 1 ! -name skills -exec rm -rf {} +",
        "mkdir -p /workspace/.impel",
    ].join("\n"));
}
async function checkoutGitHubRepository(sandbox, repo, options) {
    const path = sandbox.resolvePath(options.path);
    const ref = options.ref;
    const depthFlag = Number.isFinite(options.depth) && options.depth > 0
        ? ` --depth ${Math.floor(options.depth)}`
        : "";
    const remote = `https://github.com/${repo.owner}/${repo.repo}.git`;
    await runSandboxCommand(sandbox, "create checkout directory", `mkdir -p ${shellQuote(path)}`);
    await runSandboxCommand(sandbox, "configure git safe directory", `git config --global --add safe.directory ${shellQuote(path)} || true`);
    await runSandboxCommand(sandbox, "initialize git repository", `cd ${shellQuote(path)} && git init`);
    await runSandboxCommand(sandbox, "reset git remote", `cd ${shellQuote(path)} && git remote remove origin >/dev/null 2>&1 || true`);
    await runSandboxCommand(sandbox, "configure git remote", `cd ${shellQuote(path)} && git remote add origin ${shellQuote(remote)}`);
    await runSandboxCommand(sandbox, "fetch GitHub ref", `cd ${shellQuote(path)} && GIT_TERMINAL_PROMPT=0 git fetch${depthFlag} origin ${shellQuote(ref)}`);
    await runSandboxCommand(sandbox, "checkout GitHub ref", `cd ${shellQuote(path)} && git checkout --detach -f FETCH_HEAD`);
    const head = await runSandboxCommand(sandbox, "resolve checked out commit", `cd ${shellQuote(path)} && git rev-parse HEAD`);
    return {
        repo: repo.fullName,
        path,
        ref,
        sha: String(head.stdout ?? "").trim(),
    };
}
async function configureGitHubCliAuthMarker(sandbox) {
    await runSandboxCommand(sandbox, "configure gh auth marker", [
        "mkdir -p ~/.config/gh",
        "cat > ~/.config/gh/hosts.yml <<'EOF'",
        "github.com:",
        "    git_protocol: https",
        "    oauth_token: impel-firewall-auth",
        "    user: x-access-token",
        "EOF",
    ].join("\n"));
}
/** Persist a lightweight run-context marker (repos + auth to clone them) to the
 * shared sandbox BEFORE the checkout completes, so a co-resident subagent can
 * recover the parent's repos even mid-prep. */
async function writeRunContextMarker(sandbox, runContext, checkoutPlan) {
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
    }
    catch {
        // Best-effort: the full metadata write after checkout is the source of truth.
    }
}
async function writeWorkspaceMetadata(sandbox, runContext, repos, layout) {
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
        ...repos.map((repo, index) => `- ${index === 0 ? "Primary" : "Additional"} repo ${repo.repo} at ${repo.path} (${repo.sha})`),
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
async function runSandboxCommand(sandbox, label, command) {
    const result = await sandbox.run({ command });
    const stdout = String(result.stdout ?? "");
    const stderr = String(result.stderr ?? "");
    if (result.exitCode === 0)
        return { stdout, stderr };
    throw new Error([
        `Impel Eve workspace setup failed during ${label} (exit ${result.exitCode}).`,
        stderr ? `stderr: ${redact(stderr)}` : undefined,
        stdout ? `stdout: ${redact(stdout)}` : undefined,
    ]
        .filter((line) => Boolean(line))
        .join(" "));
}
function buildGitHubBrokerNetworkPolicy(token) {
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
];
const REFERENCE_REPO_INSTALLATION_PERMISSIONS = {
    contents: "read",
    metadata: "read",
};
// Centralized resolution through the impel-identity service. Dark unless the
// deployment sets IMPEL_IDENTITY_URL AND the dispatcher sent a signed v1
// identityRunToken. The service resolves the org's registry entry itself — the
// caller-asserted installationId is not consulted. Once this explicit
// centralized path is selected, every HTTP/network/payload failure fails closed
// instead of falling through to broader local credentials.
async function resolveImpelIdentityGitHubToken(runContext, options) {
    const baseUrl = process.env.IMPEL_IDENTITY_URL?.trim();
    const identityRunToken = options.identityRunToken ?? null;
    if (!baseUrl || !identityRunToken)
        return null;
    if (!identityRunToken.startsWith("v1.")) {
        throw new ImpelIdentityResolveError({
            code: "invalid_assertion",
            message: "Impel identity resolution requires a v1 server assertion.",
        });
    }
    const repos = options.scopeRepositories ??
        (runContext.repos?.length ? runContext.repos : undefined);
    let response;
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
    }
    catch {
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
    let payload;
    try {
        payload = await response.json();
    }
    catch {
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
async function resolveGitHubAccessToken(runContext, options = {}) {
    const { scopeRepositories, readOnly = false } = options;
    // When a deployment opts into centralized resolution and supplies its v1
    // assertion, the service wins over every local path (including stray static
    // tokens) and its failures are terminal.
    const identityToken = await resolveImpelIdentityGitHubToken(runContext, options);
    if (identityToken)
        return identityToken;
    const staticToken = process.env.IMPEL_EVE_GITHUB_TOKEN ??
        process.env.GITHUB_TOKEN ??
        process.env.GH_TOKEN;
    if (staticToken)
        return staticToken;
    const connectToken = await resolveVercelConnectGitHubToken(runContext, readOnly);
    if (connectToken)
        return connectToken;
    if (runContext.installationId !== undefined) {
        return createGitHubInstallationToken(String(runContext.installationId), {
            repositories: scopeRepositories,
            permissions: readOnly
                ? REFERENCE_REPO_INSTALLATION_PERMISSIONS
                : undefined,
        });
    }
    throw new Error("Attached repo checkout requires Vercel Connect GitHub app-subject access, clientContext.installationId with GitHub App fallback env, or a static IMPEL_EVE_GITHUB_TOKEN/GITHUB_TOKEN/GH_TOKEN.");
}
async function resolveVercelConnectGitHubToken(runContext, readOnly = false) {
    if (process.env.IMPEL_EVE_GITHUB_CONNECT_ENABLED === "0")
        return null;
    let connect;
    try {
        connect =
            (await import("@vercel/connect"));
    }
    catch {
        return null;
    }
    if (!connect)
        return null;
    try {
        const response = await connect.getTokenResponse(resolveVercelConnectGitHubConnectorUid(runContext.githubConnectorUid), createVercelConnectGitHubTokenParams(runContext, readOnly));
        return typeof response.token === "string" ? response.token : null;
    }
    catch (error) {
        if (hasGitHubAppFallbackEnv())
            return null;
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Vercel Connect could not mint a GitHub installation token for Eve workspace checkout. ${message}`);
    }
}
export function resolveVercelConnectGitHubConnectorUid(value = process.env.VERCEL_GITHUB_CONNECTOR_UID) {
    return readString(value) ?? DEFAULT_GITHUB_CONNECTOR_UID;
}
export function createVercelConnectGitHubTokenParams(runContext, readOnly = false) {
    const repositoryNames = githubRepositoryNamesFromRunContext(runContext);
    const permissions = readOnly
        ? [...REFERENCE_REPO_CONNECT_PERMISSIONS]
        : ["contents:write", "pull_requests:write", "checks:read", "statuses:read"];
    return stripUndefined({
        subject: { type: "app" },
        installationId: runContext.installationId === undefined
            ? undefined
            : String(runContext.installationId),
        authorizationDetails: repositoryNames.length > 0
            ? [
                {
                    type: "github_app_installation",
                    repositories: repositoryNames.length === 1
                        ? repositoryNames[0]
                        : repositoryNames,
                    permissions,
                },
            ]
            : undefined,
    });
}
function githubRepositoryNamesFromRunContext(runContext) {
    const names = new Set();
    for (const repoName of runContext.repos ?? []) {
        names.add(parseGitHubRepo(repoName).repo);
    }
    return Array.from(names);
}
const githubInstallationTokenCache = new Map();
async function createGitHubInstallationToken(installationId, options = {}) {
    const { repositories, permissions } = options;
    const apiBaseUrl = process.env.IMPEL_EVE_GITHUB_API_URL ?? "https://api.github.com";
    const appId = process.env.IMPEL_EVE_GITHUB_APP_ID ?? process.env.GITHUB_APP_ID;
    const privateKey = process.env.IMPEL_EVE_GITHUB_APP_PRIVATE_KEY ??
        process.env.GITHUB_APP_PRIVATE_KEY;
    if (!appId || !privateKey) {
        throw new Error("Attached repo checkout requires Vercel Connect GitHub app-subject access, GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY, or a static IMPEL_EVE_GITHUB_TOKEN/GITHUB_TOKEN/GH_TOKEN.");
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
        permissions: permissions && Object.keys(permissions).length > 0
            ? permissions
            : undefined,
    });
    const jwt = createGitHubAppJwt(appId, normalizePrivateKey(privateKey));
    const response = await fetch(`${apiBaseUrl}/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
        method: "POST",
        headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${jwt}`,
            "content-type": "application/json",
            "x-github-api-version": "2022-11-28",
        },
        body: Object.keys(requestBody).length > 0
            ? JSON.stringify(requestBody)
            : undefined,
    });
    const body = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(`GitHub installation token request failed with HTTP ${response.status}.`);
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
function createGitHubAppJwt(appId, privateKey) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = { exp: now + 600, iat: now - 60, iss: appId };
    const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
    return `${signingInput}.${createSign("RSA-SHA256")
        .update(signingInput)
        .sign(privateKey, "base64url")}`;
}
function base64UrlJson(value) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
}
async function parseJsonResponse(response) {
    const text = await response.text();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
function parseExpiryMs(value) {
    if (typeof value === "string") {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return Date.now() + 60 * 60 * 1000;
}
function normalizePrivateKey(value) {
    return value.replace(/\\n/g, "\n");
}
function hasGitHubAppFallbackEnv() {
    return Boolean((process.env.IMPEL_EVE_GITHUB_APP_ID ?? process.env.GITHUB_APP_ID) &&
        (process.env.IMPEL_EVE_GITHUB_APP_PRIVATE_KEY ??
            process.env.GITHUB_APP_PRIVATE_KEY));
}
function parseGitHubRepo(value) {
    const [owner, repo, ...rest] = value.split("/");
    if (!owner || !repo || rest.length > 0) {
        throw new Error(`Invalid GitHub repository name "${value}". Expected owner/repo.`);
    }
    return { owner, repo, fullName: `${owner}/${repo}` };
}
function safePathSegment(value) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, "__");
}
function readCheckoutDepthFromEnv() {
    const raw = process.env.IMPEL_EVE_GITHUB_CHECKOUT_DEPTH;
    if (raw === undefined || raw.trim() === "")
        return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function readString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function readV1RunToken(value) {
    const token = readString(value);
    return token?.startsWith("v1.") ? token : null;
}
function stripUndefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
function shellQuote(value) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}
function redact(value) {
    return value
        .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, "<github-token>")
        .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "<github-token>")
        .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer <redacted>")
        .replace(/\bBasic\s+[A-Za-z0-9+/=]+/gi, "Basic <redacted>");
}
//# sourceMappingURL=channel.js.map