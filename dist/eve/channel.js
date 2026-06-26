import { createSign } from "node:crypto";
import { defineChannel, GET, POST, } from "eve/channels";
import { httpBasic, localDev, placeholderAuth, routeAuth, vercelOidc, } from "eve/channels/auth";
const DEFAULT_GITHUB_CONNECTOR_UID = "github/useimpel-github";
const EVE_SESSION_ID_HEADER = "x-eve-session-id";
const EVE_MESSAGE_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";
export function defaultImpelEveChannel({ basicUser = process.env.EVE_APP_BASIC_USER ?? process.env.IMPEL_EVE_BASIC_USER, basicPassword = process.env.EVE_APP_BASIC_PASSWORD ?? process.env.IMPEL_EVE_BASIC_PASSWORD, includePlaceholderAuth = false, prepareAttachedRepos = true, checkoutDepth = readCheckoutDepthFromEnv(), } = {}) {
    const basic = basicUser && basicPassword
        ? [httpBasic({ username: basicUser, password: basicPassword })]
        : [];
    const auth = [
        localDev(),
        vercelOidc(),
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
                if (!prepareAttachedRepos)
                    return;
                await prepareImpelEveWorkspace(channel.state, {
                    checkoutDepth,
                    getSandbox: () => ctx.getSandbox(),
                });
            },
        },
    });
}
export function createImpelEveChannelState(runContext) {
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
        runId: readString(value.runId),
        traceId: readString(value.traceId),
        agent: isRecord(value.agent) ? value.agent : undefined,
        btParent: readString(value.btParent),
    });
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
    return [toClientContextMessage(JSON.stringify(assertJsonSerializable(value)))];
}
function toClientContextMessage(value) {
    return `Client context:\n${value}`;
}
async function prepareImpelEveWorkspace(state, options) {
    const runContext = state.runContext;
    if (!runContext?.repos?.length)
        return;
    const sandbox = await options.getSandbox();
    if (state.workspace.prepared &&
        state.workspace.sandboxId === sandbox.id &&
        state.workspace.repos.length === runContext.repos.length) {
        return;
    }
    try {
        const token = await resolveGitHubAccessToken(runContext);
        await sandbox.setNetworkPolicy(buildGitHubBrokerNetworkPolicy(token));
        await configureGitHubCliAuthMarker(sandbox);
        const prepared = [];
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
    }
    catch (error) {
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
function createImpelEveRoutes(auth) {
    return [
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
            const state = createImpelEveChannelState(normalizeImpelEveRunContext(parsed.clientContext));
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
            const state = createImpelEveChannelState(normalizeImpelEveRunContext(parsed.clientContext));
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
    const continuationToken = typeof body.continuationToken === "string" && body.continuationToken.length > 0
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
        return normalizeClientContextMessages(value);
    }
    catch (error) {
        return jsonError(error instanceof Error ? error.message : String(error), 400);
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
async function writeWorkspaceMetadata(sandbox, runContext, repos) {
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
async function resolveGitHubAccessToken(runContext) {
    const staticToken = process.env.IMPEL_EVE_GITHUB_TOKEN ??
        process.env.GITHUB_TOKEN ??
        process.env.GH_TOKEN;
    if (staticToken)
        return staticToken;
    const connectToken = await resolveVercelConnectGitHubToken(runContext);
    if (connectToken)
        return connectToken;
    if (runContext.installationId !== undefined) {
        return createGitHubInstallationToken(String(runContext.installationId));
    }
    throw new Error("Attached repo checkout requires Vercel Connect GitHub app-subject access, clientContext.installationId with GitHub App fallback env, or a static IMPEL_EVE_GITHUB_TOKEN/GITHUB_TOKEN/GH_TOKEN.");
}
async function resolveVercelConnectGitHubToken(runContext) {
    if (process.env.IMPEL_EVE_GITHUB_CONNECT_ENABLED === "0")
        return null;
    let connect;
    try {
        connect = (await import("@vercel/connect"));
    }
    catch {
        return null;
    }
    if (!connect)
        return null;
    try {
        const response = await connect.getTokenResponse(resolveVercelConnectGitHubConnectorUid(), createVercelConnectGitHubTokenParams(runContext));
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
export function createVercelConnectGitHubTokenParams(runContext) {
    const repositoryNames = githubRepositoryNamesFromRunContext(runContext);
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
                    permissions: "contents:read",
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
async function createGitHubInstallationToken(installationId) {
    const apiBaseUrl = process.env.IMPEL_EVE_GITHUB_API_URL ?? "https://api.github.com";
    const appId = process.env.IMPEL_EVE_GITHUB_APP_ID ?? process.env.GITHUB_APP_ID;
    const privateKey = process.env.IMPEL_EVE_GITHUB_APP_PRIVATE_KEY ??
        process.env.GITHUB_APP_PRIVATE_KEY;
    if (!appId || !privateKey) {
        throw new Error("Attached repo checkout requires Vercel Connect GitHub app-subject access, GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY, or a static IMPEL_EVE_GITHUB_TOKEN/GITHUB_TOKEN/GH_TOKEN.");
    }
    const cacheKey = `${apiBaseUrl}:${appId}:${installationId}`;
    const cached = githubInstallationTokenCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAtMs - 60_000) {
        return cached.token;
    }
    const jwt = createGitHubAppJwt(appId, normalizePrivateKey(privateKey));
    const response = await fetch(`${apiBaseUrl}/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
        method: "POST",
        headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${jwt}`,
            "x-github-api-version": "2022-11-28",
        },
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
function checkoutPathForRepo(repo, index) {
    if (index === 0)
        return "/workspace";
    return `/workspace/repos/${safePathSegment(repo.fullName)}`;
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