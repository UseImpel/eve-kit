import { mkdir as mkdirAsync } from "node:fs/promises";
import { join } from "node:path";
import { createAnthropic, } from "@ai-sdk/anthropic";
import { createCodexAppServer, } from "ai-sdk-provider-codex-cli";
const CLIENT_CONTEXT_SENTINEL = "Client context:\n";
const DEFAULT_CODEX_HOME_ROOT = "/tmp/impel-gateway-codex";
const RUN_TOKEN_PLACEHOLDER = "<impel-run-token>";
export function resolveImpelGatewayUrl(explicit) {
    const value = explicit ?? process.env.IMPEL_GATEWAY_URL ?? process.env.IMPEL_GATEWAY_BASE_URL;
    return value?.trim() ? withoutTrailingSlash(value) : undefined;
}
/**
 * Runs Anthropic Messages traffic through impel-gateway while keeping the normal
 * AI SDK/Eve tool loop intact. Hosted Eve agents should pass a signed run token
 * in clientContext. Static PAT auth is still accepted for local/dev callers, but
 * the per-run token wins so gateway usage can be attributed to the invoking
 * run/user/agent.
 */
export function impelGatewayClaudeModel(modelId, opts) {
    const gatewayUrl = requireGatewayUrl(opts.gatewayUrl);
    const callConfig = buildGatewayAnthropicCallConfig(opts.providerOptions);
    const probe = createGatewayAnthropicModel({
        authToken: opts.authToken ?? opts.pat ?? "impel-gateway-auth-token",
        gatewayUrl,
        modelId,
    });
    const buildInner = async (options) => {
        const invocation = await resolveGatewayInvocation(options, {
            gatewayUrl,
            gatewayAuthToken: opts.authToken ?? opts.pat,
            runContext: opts.runContext,
        });
        const inner = createGatewayAnthropicModel({
            authToken: invocation.authToken,
            gatewayUrl: invocation.gatewayUrl,
            modelId,
        });
        return {
            inner,
            options: withGatewayAnthropicCallOptions(options, callConfig, invocation.runToken),
        };
    };
    return {
        ...probe,
        provider: "anthropic.impel-gateway",
        async doGenerate(options) {
            const { inner, options: nextOptions } = await buildInner(options);
            return inner.doGenerate(nextOptions);
        },
        async doStream(options) {
            const { inner, options: nextOptions } = await buildInner(options);
            return inner.doStream(nextOptions);
        },
    };
}
function createGatewayAnthropicModel(args) {
    return createAnthropic(buildGatewayAnthropicProviderSettings({
        gatewayUrl: args.gatewayUrl,
        authToken: args.authToken,
    }))(args.modelId);
}
export function impelGatewayCodexModel(modelId, opts) {
    const gatewayUrl = requireGatewayUrl(opts.gatewayUrl);
    const probeProvider = createCodexAppServer();
    const probe = probeProvider(modelId);
    void probeProvider.close().catch(() => { });
    const buildInner = async (options) => {
        const invocation = await resolveGatewayInvocation(options, {
            gatewayUrl,
            gatewayAuthToken: opts.authToken,
            runContext: opts.runContext,
        });
        const settings = createCodexGatewaySettings({
            providerOptions: opts.providerOptions,
            invocation,
            codexHomeRoot: opts.codexHomeRoot,
        });
        if (settings.env?.CODEX_HOME) {
            await mkdirAsync(settings.env.CODEX_HOME, { recursive: true, mode: 0o700 });
        }
        const provider = createCodexAppServer({ defaultSettings: settings });
        const inner = provider(modelId);
        return {
            provider,
            inner,
            options: {
                ...options,
                prompt: scrubPromptRunToken(options.prompt, invocation.runToken),
            },
        };
    };
    return {
        ...probe,
        provider: "impel-gateway",
        async doGenerate(options) {
            const { provider, inner, options: nextOptions } = await buildInner(options);
            try {
                return await inner.doGenerate(nextOptions);
            }
            finally {
                await closeCodexProvider(provider);
            }
        },
        async doStream(options) {
            const { provider, inner, options: nextOptions } = await buildInner(options);
            try {
                const result = await inner.doStream(nextOptions);
                return {
                    ...result,
                    stream: wrapStreamWithCleanup(result.stream, () => closeCodexProvider(provider)),
                };
            }
            catch (error) {
                await closeCodexProvider(provider);
                throw error;
            }
        },
    };
}
export function buildGatewayClaudeCodeSettings(args) {
    const source = args.providerOptions ?? {};
    const scoped = mergeScopedProviderOptions(source, [
        "claude-code",
        "claude_code",
        "claude",
        "anthropic",
    ]);
    const merged = normalizeClaudeEffortOptions({ ...source, ...scoped });
    const env = stringRecordWithUndefinedValue(merged.env);
    return pruneUndefined({
        permissionMode: merged.permissionMode,
        allowDangerouslySkipPermissions: booleanValue(merged.allowDangerouslySkipPermissions),
        effort: stringValue(merged.effort),
        allowedTools: stringArrayValue(merged.allowedTools),
        disallowedTools: stringArrayValue(merged.disallowedTools),
        maxTurns: numberValue(merged.maxTurns),
        agents: plainObjectValue(merged.agents),
        forwardSubagentText: booleanValue(merged.forwardSubagentText),
        agentProgressSummaries: booleanValue(merged.agentProgressSummaries),
        skills: merged.skills === "all" ? "all" : stringArrayValue(merged.skills),
        settingSources: stringArrayValue(merged.settingSources) ??
            [],
        mcpServers: plainObjectValue(merged.mcpServers),
        promptSuggestions: booleanValue(merged.promptSuggestions),
        cwd: stringValue(merged.cwd),
        sessionId: stringValue(merged.sessionId),
        resume: stringValue(merged.resume),
        continue: booleanValue(merged.continue),
        forkSession: booleanValue(merged.forkSession),
        persistSession: booleanValue(merged.persistSession),
        title: stringValue(merged.title),
        fallbackModel: stringValue(merged.fallbackModel),
        managedSettings: plainObjectValue(merged.managedSettings),
        toolAliases: plainObjectValue(merged.toolAliases),
        toolConfig: plainObjectValue(merged.toolConfig),
        stderr: typeof merged.stderr === "function"
            ? merged.stderr
            : logClaudeCodeStderr,
        env: {
            ...env,
            ANTHROPIC_BASE_URL: `${withoutTrailingSlash(args.gatewayUrl)}/anthropic`,
            ANTHROPIC_AUTH_TOKEN: args.pat,
            ANTHROPIC_API_KEY: undefined,
            CLAUDE_CODE_OAUTH_TOKEN: undefined,
            CLAUDE_CONFIG_DIR: args.configDir,
            CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST: "1",
            CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "0",
            CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
            DISABLE_LOGIN_COMMAND: "1",
            DISABLE_LOGOUT_COMMAND: "1",
        },
    });
}
export function buildGatewayAnthropicProviderSettings(args) {
    return pruneUndefined({
        baseURL: `${withoutTrailingSlash(args.gatewayUrl)}/anthropic/v1`,
        authToken: args.authToken,
        headers: args.headers,
        name: "anthropic.impel-gateway",
    });
}
export function buildGatewayAnthropicCallConfig(providerOptions) {
    const source = providerOptions ?? {};
    const scoped = mergeScopedProviderOptions(source, [
        "anthropic",
        "claude",
        "claude_code",
        "claude-code",
    ]);
    const merged = { ...source, ...scoped };
    const anthropicOptions = pruneUndefined({
        sendReasoning: booleanValue(merged.sendReasoning),
        structuredOutputMode: stringValue(merged.structuredOutputMode),
        thinking: plainObjectValue(merged.thinking),
        disableParallelToolUse: booleanValue(merged.disableParallelToolUse),
        cacheControl: plainObjectValue(merged.cacheControl),
        metadata: plainObjectValue(merged.metadata),
        mcpServers: arrayValue(merged.mcpServers),
        container: plainObjectValue(merged.container),
        toolStreaming: booleanValue(merged.toolStreaming),
        effort: stringValue(merged.effort),
        taskBudget: plainObjectValue(merged.taskBudget),
        speed: stringValue(merged.speed),
        inferenceGeo: stringValue(merged.inferenceGeo),
        fallbacks: arrayValue(merged.fallbacks),
        anthropicBeta: stringArrayValue(merged.anthropicBeta),
        contextManagement: plainObjectValue(merged.contextManagement),
    });
    return Object.keys(anthropicOptions).length
        ? {
            providerOptions: {
                anthropic: anthropicOptions,
            },
        }
        : {};
}
export function buildGatewayCodexAppServerSettings(args) {
    return createCodexGatewaySettings({
        providerOptions: args.providerOptions,
        invocation: {
            gatewayUrl: requireGatewayUrl(args.gatewayUrl),
            authToken: args.authToken,
            orgId: args.orgId,
            runId: args.runId,
        },
        codexHomeRoot: args.codexHomeRoot,
    });
}
function inferClaudeCodeLocalModel(modelId, fallback = "opus") {
    if (/sonnet/i.test(modelId))
        return "sonnet";
    if (/haiku/i.test(modelId))
        return "haiku";
    return fallback;
}
function withoutTrailingSlash(value) {
    return value.trim().replace(/\/+$/, "");
}
function requireGatewayUrl(value) {
    const resolved = resolveImpelGatewayUrl(value);
    if (!resolved) {
        throw new Error("IMPEL_GATEWAY_URL or gatewayUrl is required to route this agent through impel-gateway.");
    }
    return resolved;
}
function messageContentToText(content) {
    if (typeof content === "string")
        return content;
    if (Array.isArray(content)) {
        return content
            .filter((part) => part?.type === "text" && typeof part.text === "string")
            .map((part) => part.text ?? "")
            .join("");
    }
    return "";
}
function safeJsonObject(raw) {
    try {
        const parsed = JSON.parse(raw);
        return isPlainObject(parsed) ? parsed : undefined;
    }
    catch {
        return undefined;
    }
}
function findJsonObjectEnd(text) {
    let depth = 0;
    let escaped = false;
    let inString = false;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            if (escaped) {
                escaped = false;
            }
            else if (char === "\\") {
                escaped = true;
            }
            else if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
        }
        else if (char === "{") {
            depth += 1;
        }
        else if (char === "}") {
            depth -= 1;
            if (depth === 0)
                return index;
            if (depth < 0)
                return undefined;
        }
    }
    return undefined;
}
function extractClientContextObject(raw) {
    const text = raw.replace(/^\s+/, "");
    if (!text.startsWith(CLIENT_CONTEXT_SENTINEL))
        return undefined;
    const tail = text.slice(CLIENT_CONTEXT_SENTINEL.length).replace(/^\s+/, "");
    if (!tail.startsWith("{"))
        return safeJsonObject(tail);
    const end = findJsonObjectEnd(tail);
    if (end === undefined)
        return safeJsonObject(tail);
    return safeJsonObject(tail.slice(0, end + 1));
}
function normalizePromptRunContext(obj) {
    const orgId = stringValue(obj.orgId);
    const repos = Array.isArray(obj.repos) && obj.repos.every((item) => typeof item === "string")
        ? obj.repos
        : undefined;
    const branch = stringValue(obj.branch);
    const installationId = typeof obj.installationId === "string"
        ? obj.installationId
        : typeof obj.installationId === "number" &&
            Number.isFinite(obj.installationId)
            ? String(obj.installationId)
            : undefined;
    const githubConnectorUid = stringValue(obj.githubConnectorUid);
    const runId = stringValue(obj.runId);
    const traceId = stringValue(obj.traceId);
    const agent = plainObjectValue(obj.agent);
    const runToken = stringValue(obj.runToken);
    return orgId ||
        repos ||
        branch ||
        installationId ||
        githubConnectorUid ||
        runId ||
        traceId ||
        agent ||
        runToken
        ? {
            orgId,
            repos,
            branch,
            installationId,
            githubConnectorUid,
            runId,
            traceId,
            agent,
            runToken,
        }
        : null;
}
function extractRunContextFromPrompt(prompt) {
    for (const msg of prompt) {
        if (msg.role !== "user" && msg.role !== "system")
            continue;
        const raw = messageContentToText(msg.content);
        const parsed = extractClientContextObject(raw);
        return parsed ? normalizePromptRunContext(parsed) : null;
    }
    return null;
}
async function resolveConfiguredRunContext(runContext) {
    if (!runContext)
        return null;
    return typeof runContext === "function" ? await runContext() : runContext;
}
function envRunContext() {
    return {
        orgId: process.env.IMPEL_ORG_ID,
        repos: process.env.IMPEL_RUN_REPOS?.split(",").filter(Boolean),
        branch: process.env.IMPEL_RUN_BRANCH,
        installationId: process.env.IMPEL_RUN_INSTALLATION_ID,
        runId: process.env.IMPEL_RUN_ID,
        traceId: process.env.IMPEL_RUN_TRACE_ID ?? process.env.IMPEL_RUN_ID,
        agent: process.env.IMPEL_RUN_AGENT
            ? safeJsonObject(process.env.IMPEL_RUN_AGENT)
            : undefined,
        runToken: process.env.IMPEL_RUN_TOKEN,
    };
}
async function resolveGatewayInvocation(options, args) {
    const gatewayUrl = requireGatewayUrl(args.gatewayUrl);
    const promptContext = extractRunContextFromPrompt(options.prompt);
    const configuredContext = await resolveConfiguredRunContext(args.runContext);
    const fallbackContext = envRunContext();
    const runToken = promptContext?.runToken ??
        configuredContext?.runToken ??
        fallbackContext.runToken;
    const authToken = runToken ??
        args.gatewayAuthToken ??
        process.env.IMPEL_GATEWAY_AUTH_TOKEN ??
        process.env.IMPEL_GATEWAY_PAT ??
        process.env.IMPEL_GATEWAY_API_KEY ??
        process.env.IMPEL_PAT;
    if (!authToken) {
        throw new Error("An Impel gateway credential is required. Pass a signed run token in Eve clientContext, set IMPEL_RUN_TOKEN, or configure IMPEL_GATEWAY_AUTH_TOKEN.");
    }
    return {
        gatewayUrl,
        authToken,
        runToken,
        orgId: promptContext?.orgId ??
            configuredContext?.orgId ??
            fallbackContext.orgId,
        runId: promptContext?.runId ??
            configuredContext?.runId ??
            fallbackContext.runId,
    };
}
function withGatewayAnthropicCallOptions(options, callConfig, runToken) {
    return {
        ...options,
        prompt: scrubPromptRunToken(options.prompt, runToken),
        providerOptions: mergeProviderOptions(options.providerOptions, callConfig.providerOptions),
    };
}
function scrubPromptRunToken(prompt, runToken) {
    if (!runToken)
        return prompt;
    return prompt.map((message) => {
        if (typeof message.content === "string") {
            return {
                ...message,
                content: scrubRunToken(message.content, runToken),
            };
        }
        if (Array.isArray(message.content)) {
            return {
                ...message,
                content: message.content.map((part) => part.type === "text"
                    ? { ...part, text: scrubRunToken(part.text, runToken) }
                    : part),
            };
        }
        return message;
    });
}
function scrubRunToken(text, runToken) {
    return text.includes(runToken)
        ? text.split(runToken).join(RUN_TOKEN_PLACEHOLDER)
        : text;
}
function createCodexGatewaySettings({ providerOptions, invocation, codexHomeRoot, }) {
    const source = providerOptions ?? {};
    const scoped = mergeScopedProviderOptions(source, [
        "codex-app-server",
        "codex_app_server",
        "openai-responses",
        "openai_responses",
        "codex",
        "codex-cli",
        "codex_cli",
    ]);
    const merged = { ...source, ...scoped };
    const env = stringRecordValue(merged.env);
    const codexHome = join(codexHomeRoot ?? process.env.IMPEL_CODEX_HOME_ROOT ?? DEFAULT_CODEX_HOME_ROOT, safeSegment(invocation.orgId, "org"), safeSegment(invocation.runId, "run"));
    return pruneUndefined({
        codexPath: stringValue(merged.codexPath),
        cwd: stringValue(merged.cwd),
        verbose: booleanValue(merged.verbose),
        logger: merged.logger === false ? false : undefined,
        personality: stringValue(merged.personality),
        effort: stringValue(merged.effort ?? merged.reasoningEffort),
        summary: stringValue(merged.summary ?? merged.reasoningSummary),
        approvalPolicy: (merged.approvalPolicy ?? merged.approvalMode),
        sandboxPolicy: (merged.sandboxPolicy ?? merged.sandboxMode),
        baseInstructions: stringValue(merged.baseInstructions),
        developerInstructions: stringValue(merged.developerInstructions),
        mcpServers: plainObjectValue(merged.mcpServers),
        rmcpClient: booleanValue(merged.rmcpClient),
        autoApprove: booleanValue(merged.autoApprove),
        persistExtendedHistory: booleanValue(merged.persistExtendedHistory),
        connectionTimeoutMs: numberValue(merged.connectionTimeoutMs),
        requestTimeoutMs: numberValue(merged.requestTimeoutMs),
        idleTimeoutMs: numberValue(merged.idleTimeoutMs),
        minCodexVersion: stringValue(merged.minCodexVersion),
        threadMode: stringValue(merged.threadMode),
        resume: stringValue(merged.resume),
        includeRawChunks: booleanValue(merged.includeRawChunks),
        env: {
            ...(env ?? {}),
            CODEX_HOME: codexHome,
            IMPEL_GATEWAY_AUTH_TOKEN: invocation.authToken,
        },
        configOverrides: codexGatewayConfigOverrides(invocation.gatewayUrl, plainObjectValue(merged.configOverrides)),
    });
}
function codexGatewayConfigOverrides(gatewayUrl, existing) {
    return {
        ...(existing ?? {}),
        model_provider: "impel",
        model_providers: {
            ...(plainObjectValue(existing?.model_providers) ?? {}),
            impel: {
                name: "Impel Gateway",
                base_url: `${gatewayUrl}/chatgpt_passthrough/backend-api/codex`,
                wire_api: "responses",
                auth: {
                    command: "node",
                    args: [
                        "-e",
                        "process.stdout.write((process.env.IMPEL_GATEWAY_AUTH_TOKEN || '') + '\\n')",
                    ],
                    timeout_ms: 5000,
                    refresh_interval_ms: 300000,
                },
            },
        },
    };
}
function normalizeClaudeEffortOptions(options) {
    const next = { ...options };
    if (next.effort !== undefined)
        next.effort = normalizeClaudeEffort(next.effort);
    for (const namespace of ["anthropic", "claude", "claude_code", "claude-code"]) {
        const value = next[namespace];
        if (isPlainObject(value) && value.effort !== undefined) {
            next[namespace] = { ...value, effort: normalizeClaudeEffort(value.effort) };
        }
    }
    return next;
}
function normalizeClaudeEffort(value) {
    if (typeof value !== "string")
        return value;
    return value.trim().toLowerCase() === "xhigh" ? "high" : value;
}
function mergeScopedProviderOptions(source, namespaces) {
    return namespaces.reduce((acc, namespace) => {
        const value = source[namespace];
        return isPlainObject(value) ? { ...acc, ...value } : acc;
    }, {});
}
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function plainObjectValue(value) {
    return isPlainObject(value) ? value : undefined;
}
function arrayValue(value) {
    return Array.isArray(value) ? value : undefined;
}
function mergeProviderOptions(base, injected) {
    if (!injected || !Object.keys(injected).length)
        return base;
    if (!base || !Object.keys(base).length)
        return injected;
    const merged = { ...base };
    for (const [namespace, value] of Object.entries(injected)) {
        merged[namespace] = {
            ...(plainObjectValue(base[namespace]) ?? {}),
            ...value,
        };
    }
    return merged;
}
function stringRecordValue(value) {
    if (!isPlainObject(value))
        return undefined;
    const result = Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === "string"));
    return Object.keys(result).length ? result : undefined;
}
function stringRecordWithUndefinedValue(value) {
    if (!isPlainObject(value))
        return {};
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item === undefined || typeof item === "string"));
}
function stringValue(value) {
    return typeof value === "string" && value.trim() !== "" ? value : undefined;
}
function numberValue(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function booleanValue(value) {
    return typeof value === "boolean" ? value : undefined;
}
function stringArrayValue(value) {
    return Array.isArray(value) && value.every((item) => typeof item === "string")
        ? value
        : undefined;
}
function safeSegment(value, fallback) {
    const cleaned = (value || fallback).replace(/[^A-Za-z0-9_.:-]+/g, "_");
    return cleaned.slice(0, 96) || fallback;
}
function pruneUndefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
function wrapStreamWithCleanup(stream, cleanup) {
    const reader = stream.getReader();
    let cleaned = false;
    const closeOnce = async () => {
        if (cleaned)
            return;
        cleaned = true;
        await cleanup();
    };
    return new ReadableStream({
        async pull(controller) {
            try {
                const { done, value } = await reader.read();
                if (done) {
                    await closeOnce();
                    controller.close();
                    return;
                }
                controller.enqueue(value);
            }
            catch (error) {
                await closeOnce();
                throw error;
            }
        },
        async cancel(reason) {
            try {
                await reader.cancel(reason);
            }
            finally {
                await closeOnce();
            }
        },
    });
}
async function closeCodexProvider(provider) {
    await provider.close().catch(() => { });
}
function logClaudeCodeStderr(data) {
    const text = data.trimEnd();
    if (text)
        console.error("[impel-gateway-claude:stderr]", text);
}
//# sourceMappingURL=gateway-model.js.map