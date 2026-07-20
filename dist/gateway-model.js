import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, } from "@ai-sdk/provider";
/**
 * Typed pool-capacity error surfaced by impel-gateway.
 *
 * `retryAfter` is expressed in milliseconds. The class extends APICallError so
 * AI SDK retry machinery recognizes retryable pool errors. A
 * `model_not_entitled` error intentionally has no HTTP status and no raw cause:
 * Eve treats every visible 5xx as retryable, even when `isRetryable` is false.
 */
export class ImpelGatewayPoolError extends APICallError {
    code;
    retryable;
    retryAfter;
    retryAfterMs;
    model;
    org;
    orgId;
    constructor(options) {
        const retryable = options.code !== "model_not_entitled";
        super({
            message: poolErrorMessage(options.code, options.model),
            url: "",
            requestBodyValues: undefined,
            statusCode: retryable ? options.statusCode : undefined,
            responseHeaders: undefined,
            responseBody: undefined,
            isRetryable: retryable,
        });
        this.name = "ImpelGatewayPoolError";
        this.code = options.code;
        this.retryable = retryable;
        this.retryAfter = options.retryAfter;
        this.retryAfterMs = options.retryAfter;
        this.model = options.model;
        this.org = options.org;
        this.orgId = options.org;
    }
}
export const IMPEL_GATEWAY_MODEL_ALIASES = {
    fable: "claude-fable-5",
    opus: "claude-opus-4-8",
    sonnet: "claude-sonnet-4-6",
    haiku: "claude-haiku-4-5",
};
const CLIENT_CONTEXT_SENTINEL = "Client context:\n";
const RUN_TOKEN_PLACEHOLDER = "<impel-run-token>";
const FORBIDDEN_AUTH_HEADERS = new Set(["authorization", "x-api-key"]);
const POOL_ERROR_CODES = new Set([
    "model_not_entitled",
    "pool_exhausted",
    "pool_rate_limited",
]);
// These are the public Workflow SDK symbols used by the official AI SDK
// provider model classes. Keeping the symbols local avoids making eve-kit
// depend directly on the provider-utils implementation package.
const WORKFLOW_SERIALIZE = Symbol.for("workflow-serialize");
const WORKFLOW_DESERIALIZE = Symbol.for("workflow-deserialize");
export function normalizeImpelGatewayModelId(modelId) {
    const trimmed = modelId.trim();
    if (!trimmed)
        return trimmed;
    const withoutProvider = trimmed.replace(/^(?:anthropic|openai)\//i, "");
    return (IMPEL_GATEWAY_MODEL_ALIASES[withoutProvider.toLowerCase()] ?? withoutProvider);
}
export function resolveImpelGatewayModel(modelId) {
    const normalized = normalizeImpelGatewayModelId(modelId);
    if (!normalized) {
        throw new Error("An Impel gateway model id is required.");
    }
    if (/^claude-/i.test(normalized)) {
        return { provider: "anthropic", modelId: normalized };
    }
    if (/^(?:gpt|o\d|codex)/i.test(normalized)) {
        return { provider: "openai", modelId: normalized };
    }
    throw new Error(`Unsupported Impel gateway model id "${modelId}". Use a Claude, GPT, o-series, or Codex model id.`);
}
export function resolveImpelGatewayUrl(explicit) {
    const value = explicit ??
        process.env.IMPEL_GATEWAY_URL ??
        process.env.IMPEL_GATEWAY_BASE_URL;
    return value?.trim() ? withoutTrailingSlash(value) : undefined;
}
/**
 * Creates a conventional AI SDK LanguageModelV4 backed by impel-gateway.
 * Eve remains the owner of the tool loop; the gateway performs one model turn.
 */
export function impelGatewayModel(modelId, options = {}) {
    return new ImpelGatewayLanguageModel(modelId, options);
}
/**
 * Concrete wrapper rather than a Proxy so Workflow SDK serialization can see
 * the same constructor-level symbols exposed by official AI SDK models.
 */
export class ImpelGatewayLanguageModel {
    specificationVersion = "v4";
    provider;
    modelId;
    supportedUrls;
    configuredOptions;
    gatewayUrl;
    resolved;
    static [WORKFLOW_SERIALIZE](model) {
        return {
            modelId: model.modelId,
            options: serializeGatewayModelOptions(model.configuredOptions, model.gatewayUrl),
        };
    }
    static [WORKFLOW_DESERIALIZE](serialized) {
        return new ImpelGatewayLanguageModel(serialized.modelId, serialized.options);
    }
    constructor(modelId, options = {}) {
        this.gatewayUrl = requireGatewayUrl(options.gatewayUrl);
        this.resolved = resolveImpelGatewayModel(modelId);
        this.modelId = this.resolved.modelId;
        this.provider = `impel-gateway.${this.resolved.provider}`;
        this.configuredOptions = options;
        const probe = createProviderModel({
            authToken: "impel-gateway-unresolved-token",
            configuredHeaders: {},
            fetch: options.fetch,
            gatewayUrl: this.gatewayUrl,
            resolved: this.resolved,
        });
        this.supportedUrls = probe.supportedUrls;
    }
    async doGenerate(callOptions) {
        const { inner, options: prepared } = await this.buildCall(callOptions);
        try {
            return await inner.doGenerate(prepared);
        }
        catch (error) {
            throw mapGatewayError(error, this.resolved.modelId);
        }
    }
    async doStream(callOptions) {
        const { inner, options: prepared } = await this.buildCall(callOptions);
        try {
            const result = await inner.doStream(prepared);
            return {
                ...result,
                stream: wrapStreamErrors(result.stream, this.resolved.modelId),
            };
        }
        catch (error) {
            throw mapGatewayError(error, this.resolved.modelId);
        }
    }
    async buildCall(callOptions) {
        const invocation = await resolveGatewayInvocation(callOptions, this.configuredOptions);
        const configuredHeaders = await resolveSafeConfiguredHeaders(this.configuredOptions.headers);
        const inner = createProviderModel({
            authToken: invocation.authToken,
            configuredHeaders,
            fetch: this.configuredOptions.fetch,
            gatewayUrl: this.gatewayUrl,
            resolved: this.resolved,
        });
        return {
            inner,
            options: prepareCallOptions(callOptions, this.configuredOptions.providerOptions, invocation.tokensToScrub, this.resolved.provider),
        };
    }
}
export function impelGatewayClaudeModel(modelId, options = {}) {
    const resolved = resolveImpelGatewayModel(modelId);
    if (resolved.provider !== "anthropic") {
        throw new Error(`Model "${modelId}" is not an Anthropic model.`);
    }
    return impelGatewayModel(resolved.modelId, options);
}
export function impelGatewayCodexModel(modelId, options = {}) {
    const resolved = resolveImpelGatewayModel(modelId);
    if (resolved.provider !== "openai") {
        throw new Error(`Model "${modelId}" is not an OpenAI Responses model.`);
    }
    return impelGatewayModel(resolved.modelId, options);
}
function createProviderModel(args) {
    if (args.resolved.provider === "anthropic") {
        return createAnthropic({
            authToken: args.authToken,
            baseURL: `${args.gatewayUrl}/anthropic/v1`,
            fetch: args.fetch,
            headers: args.configuredHeaders,
        })(args.resolved.modelId);
    }
    return createOpenAI({
        apiKey: args.authToken,
        baseURL: `${args.gatewayUrl}/v1`,
        fetch: args.fetch,
        headers: args.configuredHeaders,
    }).responses(args.resolved.modelId);
}
function prepareCallOptions(options, configuredProviderOptions, tokensToScrub, provider) {
    const mergedProviderOptions = mergeProviderOptions(configuredProviderOptions, options.providerOptions);
    if (provider === "openai") {
        mergedProviderOptions.openai = {
            ...(asJsonObject(mergedProviderOptions.openai) ?? {}),
            store: false,
        };
    }
    return {
        ...options,
        headers: sanitizeHeaderRecord(options.headers),
        prompt: scrubPromptRunTokens(options.prompt, tokensToScrub),
        providerOptions: Object.keys(mergedProviderOptions).length
            ? mergedProviderOptions
            : undefined,
    };
}
async function resolveGatewayInvocation(options, configured) {
    const promptContexts = scanRunContextsFromPrompt(options.prompt);
    // Authentication is intentionally restricted to Eve's structural packing
    // contract above. Redaction is broader: sentinel-shaped context objects can
    // be quoted or forged in any prompt text, and their tokens must never reach
    // an upstream provider even though they can never authenticate this call.
    const untrustedPromptRunTokens = scanPromptRunTokensForRedaction(options.prompt);
    const currentRunToken = promptContexts.currentContext?.runToken;
    if (promptContexts.hasTrustedCurrentContext && !currentRunToken) {
        throw new Error("The trusted current Eve Client context does not contain a runToken. Refusing configured, environment, or PAT fallback.");
    }
    // A trusted current context is authoritative. The fallback cascade exists
    // only for direct AI SDK calls that have no Eve-packed current context.
    const configuredContext = promptContexts.hasTrustedCurrentContext
        ? null
        : await resolveConfiguredRunContext(configured.runContext);
    const runToken = promptContexts.hasTrustedCurrentContext
        ? currentRunToken
        : configuredContext?.runToken ?? nonEmptyString(process.env.IMPEL_RUN_TOKEN);
    const authToken = runToken ??
        nonEmptyString(configured.authToken) ??
        nonEmptyString(configured.gatewayAuthToken) ??
        nonEmptyString(configured.gatewayPat) ??
        nonEmptyString(process.env.IMPEL_GATEWAY_TOKEN) ??
        nonEmptyString(process.env.IMPEL_GATEWAY_AUTH_TOKEN) ??
        nonEmptyString(process.env.IMPEL_GATEWAY_PAT) ??
        nonEmptyString(process.env.IMPEL_PAT);
    if (!authToken) {
        throw new Error("An Impel gateway credential is required. Pass clientContext.runToken, configure runContext.runToken or authToken, or set IMPEL_RUN_TOKEN, IMPEL_GATEWAY_TOKEN, or IMPEL_PAT.");
    }
    return {
        authToken,
        tokensToScrub: uniqueRunTokens([
            ...promptContexts.runTokens,
            ...untrustedPromptRunTokens,
            runToken,
            authToken,
        ]),
    };
}
async function resolveConfiguredRunContext(provider) {
    if (!provider)
        return null;
    return typeof provider === "function" ? await provider() : provider;
}
async function resolveSafeConfiguredHeaders(headers) {
    if (!headers)
        return {};
    const resolved = typeof headers === "function" ? await headers() : headers;
    return sanitizeHeadersInit(resolved);
}
function serializeGatewayModelOptions(options, gatewayUrl) {
    const headers = resolveSynchronousOption(options.headers, "headers");
    const runContext = resolveSynchronousOption(options.runContext, "runContext");
    const serialized = { gatewayUrl };
    for (const key of [
        "authToken",
        "gatewayAuthToken",
        "gatewayPat",
    ]) {
        if (typeof options[key] === "string")
            serialized[key] = options[key];
    }
    if (headers)
        serialized.headers = sanitizeHeadersInit(headers);
    if (runContext) {
        serialized.runContext = cloneWorkflowJson(runContext, "runContext");
    }
    if (options.providerOptions) {
        serialized.providerOptions = cloneWorkflowJson(options.providerOptions, "providerOptions");
    }
    // A custom fetch implementation is process-local. Like the official AI SDK
    // provider serializers, deserialization deliberately returns to global fetch.
    return serialized;
}
function resolveSynchronousOption(value, label) {
    const resolved = typeof value === "function"
        ? value()
        : value;
    if (isPromiseLike(resolved)) {
        throw new Error(`Cannot serialize an Impel gateway model: ${label} returned a Promise. Workflow model serialization only supports synchronous values.`);
    }
    return resolved;
}
function cloneWorkflowJson(value, label) {
    if (!isWorkflowJsonSerializable(value)) {
        throw new Error(`Cannot serialize an Impel gateway model: ${label} must be JSON-serializable.`);
    }
    return JSON.parse(JSON.stringify(value));
}
function isWorkflowJsonSerializable(value) {
    if (value === null || value === undefined)
        return true;
    if (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean") {
        return true;
    }
    if (Array.isArray(value))
        return value.every(isWorkflowJsonSerializable);
    return (typeof value === "object" &&
        Object.getPrototypeOf(value) === Object.prototype &&
        Object.values(value).every(isWorkflowJsonSerializable));
}
function isPromiseLike(value) {
    return ((typeof value === "object" || typeof value === "function") &&
        value !== null &&
        typeof value.then === "function");
}
function sanitizeHeadersInit(headers) {
    const safe = {};
    new Headers(headers).forEach((value, name) => {
        if (!FORBIDDEN_AUTH_HEADERS.has(name.toLowerCase()))
            safe[name] = value;
    });
    return safe;
}
function sanitizeHeaderRecord(headers) {
    if (!headers)
        return undefined;
    const safe = Object.fromEntries(Object.entries(headers).filter(([name, value]) => value !== undefined &&
        !FORBIDDEN_AUTH_HEADERS.has(name.toLowerCase())));
    return Object.keys(safe).length ? safe : undefined;
}
function scanRunContextsFromPrompt(prompt) {
    const userRuns = [];
    let runStart;
    for (let index = 0; index <= prompt.length; index += 1) {
        if (index < prompt.length && prompt[index]?.role === "user") {
            runStart ??= index;
            continue;
        }
        if (runStart !== undefined) {
            userRuns.push({ start: runStart, end: index - 1 });
            runStart = undefined;
        }
    }
    const contextsByRun = userRuns.map(({ start, end }) => {
        const contexts = [];
        // The final message of each consecutive user-role run is the actual user
        // input. Eve 0.22.1 inserts input.context messages immediately before it.
        for (let index = start; index < end; index += 1) {
            const context = parseStandalonePackedRunContext(prompt[index]);
            if (context)
                contexts.push(context);
        }
        return contexts;
    });
    const currentContexts = contextsByRun.at(-1) ?? [];
    const allContexts = contextsByRun.flat();
    return {
        hasTrustedCurrentContext: currentContexts.length > 0,
        // When more than one exact packed object is present in the trusted current
        // block, the last one is authoritative and a tokenless value fails closed.
        currentContext: currentContexts.at(-1) ?? null,
        // Historical blocks are scanned only through the same structural rule and
        // are used exclusively for redaction, never authentication.
        runTokens: uniqueRunTokens(allContexts.map((context) => context.runToken)),
    };
}
function parseStandalonePackedRunContext(message) {
    if (message?.role !== "user" ||
        message.content.length !== 1 ||
        message.content[0]?.type !== "text") {
        return undefined;
    }
    const packedText = message.content[0].text;
    if (!packedText.startsWith(CLIENT_CONTEXT_SENTINEL))
        return undefined;
    const rawObject = packedText.slice(CLIENT_CONTEXT_SENTINEL.length);
    if (!rawObject.startsWith("{"))
        return undefined;
    const end = findJsonObjectEnd(rawObject);
    if (end !== rawObject.length - 1)
        return undefined;
    const parsed = safeJsonObject(rawObject);
    return parsed ? normalizePromptRunContext(parsed) : undefined;
}
function scanPromptRunTokensForRedaction(prompt) {
    const runTokens = [];
    const visited = new WeakSet();
    for (const message of prompt) {
        collectPromptRunTokens(message, runTokens, visited);
    }
    return uniqueRunTokens(runTokens);
}
function collectPromptRunTokens(value, runTokens, visited) {
    if (typeof value === "string") {
        for (const context of extractEmbeddedClientContexts(value)) {
            for (const key of ["runToken", "identityRunToken"]) {
                const runToken = nonEmptyString(context[key]);
                if (runToken)
                    runTokens.push(runToken);
            }
        }
        return;
    }
    if (typeof value !== "object" || value === null || visited.has(value)) {
        return;
    }
    visited.add(value);
    if (Array.isArray(value)) {
        for (const item of value)
            collectPromptRunTokens(item, runTokens, visited);
        return;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null) {
        return;
    }
    for (const item of Object.values(value)) {
        collectPromptRunTokens(item, runTokens, visited);
    }
}
function extractEmbeddedClientContexts(text) {
    const contexts = [];
    let cursor = 0;
    while (cursor < text.length) {
        const sentinel = text.indexOf(CLIENT_CONTEXT_SENTINEL, cursor);
        if (sentinel < 0)
            break;
        let objectStart = sentinel + CLIENT_CONTEXT_SENTINEL.length;
        while (/\s/.test(text[objectStart] ?? ""))
            objectStart += 1;
        if (text[objectStart] !== "{") {
            cursor = objectStart;
            continue;
        }
        const relativeEnd = findJsonObjectEnd(text.slice(objectStart));
        if (relativeEnd === undefined) {
            cursor = objectStart + 1;
            continue;
        }
        const objectEnd = objectStart + relativeEnd + 1;
        const context = safeJsonObject(text.slice(objectStart, objectEnd));
        if (context)
            contexts.push(context);
        cursor = objectEnd;
    }
    return contexts;
}
function findJsonObjectEnd(text) {
    let depth = 0;
    let escaped = false;
    let inString = false;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            if (escaped)
                escaped = false;
            else if (char === "\\")
                escaped = true;
            else if (char === '"')
                inString = false;
            continue;
        }
        if (char === '"')
            inString = true;
        else if (char === "{")
            depth += 1;
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
function normalizePromptRunContext(obj) {
    const installationId = typeof obj.installationId === "number" && Number.isFinite(obj.installationId)
        ? String(obj.installationId)
        : nonEmptyString(obj.installationId);
    return {
        orgId: nonEmptyString(obj.orgId),
        repos: Array.isArray(obj.repos) &&
            obj.repos.every((item) => typeof item === "string")
            ? obj.repos
            : undefined,
        branch: nonEmptyString(obj.branch),
        installationId,
        githubConnectorUid: nonEmptyString(obj.githubConnectorUid),
        runId: nonEmptyString(obj.runId),
        traceId: nonEmptyString(obj.traceId),
        agent: asJsonObject(obj.agent),
        runToken: nonEmptyString(obj.runToken),
    };
}
function scrubPromptRunTokens(prompt, runTokens) {
    if (runTokens.length === 0)
        return prompt;
    return prompt.map((message) => {
        // Scrub every textual leaf that can be replayed to a provider,
        // including assistant history, tool-result JSON, and provider options,
        // while leaving non-plain values such as URL and Uint8Array file data
        // intact.
        return scrubPromptValue(message, runTokens);
    });
}
function scrubPromptValue(value, runTokens) {
    if (typeof value === "string")
        return scrubRunTokens(value, runTokens);
    if (Array.isArray(value)) {
        return value.map((item) => scrubPromptValue(item, runTokens));
    }
    if (typeof value !== "object" ||
        value === null ||
        (Object.getPrototypeOf(value) !== Object.prototype &&
            Object.getPrototypeOf(value) !== null)) {
        return value;
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        scrubPromptValue(item, runTokens),
    ]));
}
function scrubRunTokens(text, runTokens) {
    let scrubbed = text;
    for (const runToken of runTokens) {
        scrubbed = scrubbed.includes(runToken)
            ? scrubbed.split(runToken).join(RUN_TOKEN_PLACEHOLDER)
            : scrubbed;
    }
    return scrubbed;
}
function uniqueRunTokens(values) {
    return [
        ...new Set(values.flatMap((value) => {
            const runToken = nonEmptyString(value);
            return runToken ? [runToken] : [];
        })),
    ].sort((left, right) => right.length - left.length);
}
function mergeProviderOptions(configured, perCall) {
    const merged = { ...(configured ?? {}) };
    for (const [namespace, value] of Object.entries(perCall ?? {})) {
        merged[namespace] = {
            ...(asJsonObject(merged[namespace]) ?? {}),
            ...(asJsonObject(value) ?? {}),
        };
    }
    return merged;
}
function wrapStreamErrors(stream, modelId) {
    const reader = stream.getReader();
    let finished = false;
    return new ReadableStream({
        async pull(controller) {
            try {
                const next = await reader.read();
                if (next.done) {
                    finished = true;
                    reader.releaseLock();
                    controller.close();
                    return;
                }
                const part = next.value;
                controller.enqueue(part.type === "error"
                    ? { ...part, error: mapGatewayError(part.error, modelId) }
                    : part);
            }
            catch (error) {
                if (!finished) {
                    finished = true;
                    reader.releaseLock();
                }
                controller.error(mapGatewayError(error, modelId));
            }
        },
        async cancel(reason) {
            if (finished)
                return;
            finished = true;
            try {
                await reader.cancel(reason);
            }
            finally {
                reader.releaseLock();
            }
        },
    });
}
function mapGatewayError(error, fallbackModel) {
    if (error instanceof ImpelGatewayPoolError)
        return error;
    const apiError = APICallError.isInstance(error) ? error : undefined;
    const candidates = [];
    if (apiError?.responseBody) {
        const parsed = safeJsonValue(apiError.responseBody);
        if (parsed !== undefined)
            candidates.push(parsed);
    }
    if (apiError?.data !== undefined)
        candidates.push(apiError.data);
    candidates.push(error);
    for (const candidate of candidates) {
        const details = readPoolErrorDetails(candidate);
        if (!details)
            continue;
        const retryAfter = details.retryAfter ?? readRetryAfter(apiError?.responseHeaders);
        return new ImpelGatewayPoolError({
            code: details.code,
            message: details.message ??
                (error instanceof Error ? error.message : details.code),
            retryAfter,
            model: details.model ?? fallbackModel,
            org: details.org,
            statusCode: apiError?.statusCode,
        });
    }
    if (apiError) {
        return new APICallError({
            message: gatewayRequestErrorMessage(apiError.statusCode, fallbackModel),
            url: "",
            requestBodyValues: undefined,
            statusCode: apiError.statusCode,
            responseHeaders: undefined,
            responseBody: undefined,
            isRetryable: apiError.isRetryable,
        });
    }
    const sanitized = new Error(gatewayRequestErrorMessage(undefined, fallbackModel));
    sanitized.name = "ImpelGatewayError";
    return sanitized;
}
function gatewayRequestErrorMessage(statusCode, model) {
    const status = statusCode === undefined ? "" : ` with HTTP ${statusCode}`;
    return `Gateway request failed${status} for model ${model}.`;
}
function poolErrorMessage(code, model) {
    const suffix = model ? ` for model ${model}` : "";
    if (code === "model_not_entitled") {
        return `The organization is not entitled to use this model${suffix}.`;
    }
    if (code === "pool_rate_limited") {
        return `The provider pool is temporarily rate limited${suffix}.`;
    }
    return `No provider capacity is currently available${suffix}.`;
}
function readPoolErrorDetails(value) {
    const root = asJsonObject(value);
    if (!root)
        return undefined;
    const body = asJsonObject(root.error) ?? root;
    const code = poolErrorCode(body.code) ?? poolErrorCode(body.type);
    if (!code)
        return undefined;
    const impel = asJsonObject(body.impel) ?? asJsonObject(root.impel);
    return {
        code,
        message: nonEmptyString(body.message),
        retryAfter: finiteNumber(impel?.retryAfterMs),
        model: nonEmptyString(impel?.model),
        org: nonEmptyString(impel?.orgId) ?? nonEmptyString(impel?.org),
    };
}
function readRetryAfter(headers) {
    if (!headers)
        return undefined;
    const normalized = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
    const retryAfterMs = Number(normalized["retry-after-ms"]);
    if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0)
        return retryAfterMs;
    const raw = normalized["retry-after"];
    if (!raw)
        return undefined;
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0)
        return seconds * 1000;
    const date = Date.parse(raw);
    if (!Number.isFinite(date))
        return undefined;
    return Math.max(0, date - Date.now());
}
function poolErrorCode(value) {
    return typeof value === "string" &&
        POOL_ERROR_CODES.has(value)
        ? value
        : undefined;
}
function safeJsonValue(raw) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
}
function safeJsonObject(raw) {
    return asJsonObject(safeJsonValue(raw));
}
function asJsonObject(value) {
    return isJsonObject(value) ? value : undefined;
}
function isJsonObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonEmptyString(value) {
    return typeof value === "string" && value.trim() ? value : undefined;
}
function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : undefined;
}
function withoutTrailingSlash(value) {
    const trimmed = value.trim();
    let end = trimmed.length;
    while (end > 0 && trimmed.charCodeAt(end - 1) === 47)
        end -= 1;
    return trimmed.slice(0, end);
}
function requireGatewayUrl(explicit) {
    const gatewayUrl = resolveImpelGatewayUrl(explicit);
    if (!gatewayUrl) {
        throw new Error("IMPEL_GATEWAY_URL or gatewayUrl is required to create an Impel gateway model.");
    }
    return gatewayUrl;
}
//# sourceMappingURL=gateway-model.js.map