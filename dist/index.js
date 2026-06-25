import { JSONParseError } from "@ai-sdk/provider";
import { context, propagation } from "@opentelemetry/api";
import { parseJsonEventStream, } from "@ai-sdk/provider-utils";
import { z } from "zod";
const streamPartSchema = z.object({ type: z.string() }).passthrough();
const errorSchema = z
    .object({ error: z.object({ message: z.string() }).passthrough() })
    .passthrough();
class StartEndpointUnavailableError extends Error {
}
const CLIENT_CONTEXT_SENTINEL = "Client context:\n";
function envNumber(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
}
function redactString(value) {
    return value
        .replace(/(https?:\/\/)(x-access-token:)[^@\s/]+@/gi, "$1$2<redacted>@")
        .replace(/(x-access-token:)[^@\s]+@/gi, "$1<redacted>@")
        .replace(/(https?:\/\/)[^/\s:@]+:[^@\s/]+@github\.com/gi, "$1<redacted>:<redacted>@github.com")
        .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "<github-token>")
        .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer <redacted>")
        .replace(/\bBasic\s+[A-Za-z0-9+/=]+/gi, "Basic <redacted>");
}
function redactSecrets(value, seen = new WeakSet()) {
    if (typeof value === "string")
        return redactString(value);
    if (value === null || typeof value !== "object")
        return value;
    if (seen.has(value))
        return "[circular]";
    seen.add(value);
    if (value instanceof Error) {
        const cause = "cause" in value
            ? redactSecrets(value.cause, seen)
            : undefined;
        const error = cause === undefined
            ? new Error(redactString(value.message))
            : new Error(redactString(value.message), { cause });
        error.name = value.name;
        if (typeof value.stack === "string") {
            error.stack = redactString(value.stack);
        }
        for (const key of Object.getOwnPropertyNames(value)) {
            if (["message", "name", "stack", "cause"].includes(key))
                continue;
            error[key] = redactSecrets(value[key], seen);
        }
        return error;
    }
    if (Array.isArray(value)) {
        return value.map((item) => redactSecrets(item, seen));
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        redactSecrets(item, seen),
    ]));
}
function redactStreamPart(part) {
    return redactSecrets(part);
}
function isReasoningStreamPart(part) {
    return (part.type === "reasoning-start" ||
        part.type === "reasoning-delta" ||
        part.type === "reasoning-end");
}
function safeJsonStringify(value) {
    try {
        return JSON.stringify(value);
    }
    catch {
        return undefined;
    }
}
function stringField(value, key) {
    const field = value[key];
    return typeof field === "string" && field.trim() !== ""
        ? field
        : undefined;
}
function errorMessageFromValue(value, fallback) {
    if (value instanceof Error) {
        const name = value.name && value.name !== "Error" ? value.name : undefined;
        if (value.message && name && !value.message.includes(name)) {
            return `${name}: ${value.message}`;
        }
        return value.message || name || fallback;
    }
    if (typeof value === "string")
        return value || fallback;
    if (value && typeof value === "object") {
        const record = value;
        const name = stringField(record, "name");
        const message = stringField(record, "message");
        if (message && name && !message.includes(name)) {
            return `${name}: ${message}`;
        }
        if (message)
            return message;
        const nested = record.error;
        if (nested && typeof nested === "object") {
            const nestedMessage = errorMessageFromValue(nested, "");
            if (nestedMessage)
                return nestedMessage;
        }
        else if (typeof nested === "string" && nested.trim() !== "") {
            return nested;
        }
        const responseBody = record.responseBody ?? record.body ?? record.data;
        const responseText = typeof responseBody === "string"
            ? responseBody
            : responseBody == null
                ? undefined
                : safeJsonStringify(responseBody);
        if (responseText && responseText !== "{}") {
            return name ? `${name}: ${responseText}` : responseText;
        }
        const keys = Object.keys(record).filter((key) => record[key] !== undefined);
        if (name && keys.length === 1)
            return name;
        const json = safeJsonStringify(value);
        if (json && json !== "{}")
            return json;
        if (name)
            return name;
    }
    const asString = String(value);
    return asString && asString !== "[object Object]" ? asString : fallback;
}
function textContent(content) {
    return content
        .map((part) => part.type === "text" || part.type === "reasoning" ? part.text : "")
        .join("")
        .trim();
}
function errorFromUnknown(error, fallback, context) {
    const redacted = redactSecrets(error);
    let message = errorMessageFromValue(redacted, fallback);
    const partialOutput = context?.partialOutput?.trim();
    if (partialOutput) {
        const redactedPartial = redactString(partialOutput).slice(0, 1000);
        if (redactedPartial && !message.includes(redactedPartial)) {
            message += `; partial provider output: ${redactedPartial}`;
        }
    }
    const cause = redacted instanceof Error &&
        "cause" in redacted &&
        redacted.cause !== undefined
        ? redacted.cause
        : redacted;
    const normalized = new Error(redactString(message).slice(0, 2000), {
        cause,
    });
    if (redacted instanceof Error) {
        normalized.name = redacted.name;
    }
    else if (redacted && typeof redacted === "object") {
        const name = stringField(redacted, "name");
        if (name)
            normalized.name = name;
    }
    return normalized;
}
function redactedError(error) {
    return errorFromUnknown(error, "impel-inference provider error");
}
function headersInitToRecord(headers) {
    if (!headers)
        return {};
    return Object.fromEntries(new Headers(headers).entries());
}
async function resolveExtraHeaders(headers) {
    if (!headers)
        return {};
    const resolved = typeof headers === "function" ? await headers() : headers;
    return headersInitToRecord(resolved);
}
async function inferenceHeaders({ apiKey, orgId, extraHeaders, }) {
    const headers = {
        ...(await resolveExtraHeaders(extraHeaders)),
        authorization: `Bearer ${apiKey}`,
        "x-org-id": orgId,
        "x-impel-org-id": orgId,
        "content-type": "application/json",
    };
    // Propagate the caller's active trace context as a W3C `traceparent` so
    // impel-inference can re-root its tool-loop spans under the hosted eve agent's
    // `ai.eve.turn` trace — unifying the agent-service and inference spans into one
    // trace (impel-inference lib/tool-spans.ts re-extracts this carrier as the root
    // context for every tool span). No-op when the caller has no OTel provider /
    // W3C propagator active, so it's safe in non-instrumented callers.
    propagation.inject(context.active(), headers);
    return headers;
}
function parseStreamTailIndex(response) {
    const value = response.headers.get("x-workflow-stream-tail-index");
    if (value == null || value.trim() === "")
        return undefined;
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n >= 0 ? n : undefined;
}
async function inferenceResponseError(response) {
    const body = await response.text().catch(() => "");
    let message = body;
    try {
        const parsed = errorSchema.safeParse(JSON.parse(body));
        if (parsed.success)
            message = parsed.data.error.message;
    }
    catch {
        // Keep the raw body as the fallback message.
    }
    return new Error(`impel-inference request failed: HTTP ${response.status} ${redactString(message).slice(0, 1000)}`);
}
async function openInferenceStream({ url, headers, body, method = "GET", }) {
    const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok)
        throw await inferenceResponseError(response);
    if (!response.body) {
        throw new Error("impel-inference response had no stream body");
    }
    const tailIndex = parseStreamTailIndex(response);
    return {
        stream: parseJsonEventStream({
            stream: response.body,
            schema: streamPartSchema,
        }),
        runId: response.headers.get("x-workflow-run-id") ?? undefined,
        nextStartIndex: tailIndex == null ? undefined : tailIndex + 1,
    };
}
async function startInferenceStream({ baseUrl, headers, body, orgId, }) {
    const response = await fetch(`${baseUrl}/v1/infer/start`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
    if (response.status === 404 || response.status === 405) {
        throw new StartEndpointUnavailableError("impel-inference /v1/infer/start is unavailable");
    }
    if (!response.ok)
        throw await inferenceResponseError(response);
    const payload = (await response.json().catch(() => undefined));
    const runId = typeof payload?.runId === "string"
        ? payload.runId
        : response.headers.get("x-workflow-run-id") ?? undefined;
    if (!runId) {
        throw new Error("impel-inference /v1/infer/start returned no runId");
    }
    const streamUrl = new URL(typeof payload?.streamUrl === "string"
        ? payload.streamUrl
        : `/v1/infer/runs/${encodeURIComponent(runId)}/stream`, `${baseUrl}/`);
    if (!streamUrl.searchParams.has("startIndex")) {
        streamUrl.searchParams.set("startIndex", "0");
    }
    if (!streamUrl.searchParams.has("orgId")) {
        streamUrl.searchParams.set("orgId", orgId);
    }
    const stream = await openInferenceStream({ url: streamUrl.toString(), headers });
    return {
        stream: stream.stream,
        runId: stream.runId ?? runId,
        nextStartIndex: stream.nextStartIndex,
    };
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function providerMetadata(part, provider) {
    const metadata = "providerMetadata" in part ? part.providerMetadata : undefined;
    const scoped = metadata?.[provider];
    return scoped && typeof scoped === "object"
        ? scoped
        : undefined;
}
function rejectedFinishMessage({ part, runId, label, }) {
    if (part.type !== "finish")
        return undefined;
    const claude = providerMetadata(part, "claude-code");
    const codex = providerMetadata(part, "codex-cli");
    const metadata = claude ?? codex;
    const terminalReason = typeof metadata?.terminalReason === "string"
        ? metadata.terminalReason
        : undefined;
    const raw = part.finishReason.raw ?? "";
    const runSuffix = runId ? ` (impel-inference run ${runId})` : "";
    if (metadata?.truncated === true ||
        /truncat/i.test(raw) ||
        terminalReason === "truncated") {
        return ("impel-inference returned a truncated provider stream; " +
            `refusing to mark partial ${label} output successful${runSuffix}.`);
    }
    if (part.finishReason.unified === "length" ||
        part.finishReason.unified === "error" ||
        part.finishReason.unified === "content-filter" ||
        terminalReason === "max_turns") {
        return (`impel-inference ended with finishReason=${part.finishReason.unified}` +
            `${raw ? ` raw=${raw}` : ""}` +
            `${terminalReason ? ` terminalReason=${terminalReason}` : ""}; ` +
            `refusing to treat the ${label} turn as complete${runSuffix}.`);
    }
    if (part.finishReason.unified === "other" && terminalReason !== "completed") {
        return (`impel-inference ended with non-success finishReason=other` +
            `${raw ? ` raw=${raw}` : ""}` +
            `${terminalReason ? ` terminalReason=${terminalReason}` : ""}; ` +
            `refusing to treat the ${label} turn as complete${runSuffix}.`);
    }
    return undefined;
}
function transientErrorTextState(text) {
    const normalized = text.trimStart().toLowerCase();
    if (normalized === "")
        return "possible";
    const prefix = "api error:";
    if (prefix.startsWith(normalized))
        return "possible";
    if (normalized.startsWith(prefix))
        return "match";
    return "no";
}
function stringifyErrorLike(error) {
    if (error instanceof Error)
        return error.message;
    if (typeof error === "string")
        return error;
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
function isTransientProviderError({ error, heldText, }) {
    const text = `${heldText ?? ""}\n${stringifyErrorLike(error)}`;
    return (/\b529\b/.test(text) ||
        /overloaded/i.test(text) ||
        /temporar(?:y|ily) unavailable/i.test(text) ||
        /rate.?limit/i.test(text) ||
        /\b(?:econnreset|etimedout|timeout)\b/i.test(text));
}
function isJsonParseStreamError(error) {
    if (JSONParseError.isInstance(error))
        return true;
    const text = stringifyErrorLike(error);
    return /AI_JSONParseError|JSON parsing failed/i.test(text);
}
function isUserVisibleStreamPart(part) {
    return ![
        "stream-start",
        "response-metadata",
        "finish",
        "error",
    ].includes(part.type);
}
function errorPart(message) {
    return { type: "error", error: new Error(redactString(message)) };
}
function messageContentToText(content) {
    if (typeof content === "string")
        return content;
    if (Array.isArray(content)) {
        return content
            .filter((p) => p?.type === "text" && typeof p.text === "string")
            .map((p) => p.text ?? "")
            .join("");
    }
    return "";
}
function safeJsonObject(raw) {
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object"
            ? parsed
            : undefined;
    }
    catch {
        return undefined;
    }
}
function normalizeRunContext(obj) {
    const orgId = typeof obj.orgId === "string" ? obj.orgId : undefined;
    const repos = Array.isArray(obj.repos) && obj.repos.every((r) => typeof r === "string")
        ? obj.repos
        : undefined;
    const branch = typeof obj.branch === "string" ? obj.branch : undefined;
    const installationId = typeof obj.installationId === "string"
        ? obj.installationId
        : typeof obj.installationId === "number" &&
            Number.isFinite(obj.installationId)
            ? String(obj.installationId)
            : undefined;
    const runId = typeof obj.runId === "string" ? obj.runId : undefined;
    const traceId = typeof obj.traceId === "string" ? obj.traceId : undefined;
    const agent = obj.agent && typeof obj.agent === "object"
        ? obj.agent
        : undefined;
    return orgId !== undefined ||
        repos !== undefined ||
        branch !== undefined ||
        installationId !== undefined ||
        runId !== undefined ||
        traceId !== undefined ||
        agent !== undefined
        ? { orgId, repos, branch, installationId, runId, traceId, agent }
        : null;
}
function extractRunContextFromPrompt(prompt) {
    for (const msg of prompt) {
        if (msg.role !== "user" && msg.role !== "system")
            continue;
        const raw = messageContentToText(msg.content);
        if (raw === "")
            continue;
        const text = raw.replace(/^\s+/, "");
        if (!text.startsWith(CLIENT_CONTEXT_SENTINEL))
            continue;
        const payload = text.slice(CLIENT_CONTEXT_SENTINEL.length);
        let parsed;
        try {
            parsed = JSON.parse(payload);
        }
        catch (err) {
            console.warn("[impel-inference-provider] clientContext sentinel present but JSON.parse failed; " +
                "repos will be undefined on the /v1/infer call (run may execute in an " +
                `empty workspace). error=${String(err)} payload=${JSON.stringify(payload.slice(0, 200))}`);
            return null;
        }
        if (parsed === null || typeof parsed !== "object") {
            console.warn("[impel-inference-provider] clientContext sentinel parsed to a non-object; " +
                "repos will be undefined on the /v1/infer call.");
            return null;
        }
        const context = normalizeRunContext(parsed);
        if (!context?.repos?.length) {
            console.warn("[impel-inference-provider] clientContext sentinel parsed but yielded no repos; " +
                "repos will be undefined on the /v1/infer call (run may execute in an " +
                `empty workspace). parsedKeys=${JSON.stringify(Object.keys(parsed))}`);
        }
        return context;
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
        repos: process.env.IMPEL_RUN_REPOS?.split(",").filter(Boolean),
        branch: process.env.IMPEL_RUN_BRANCH,
        installationId: process.env.IMPEL_RUN_INSTALLATION_ID,
        runId: process.env.IMPEL_RUN_ID,
        traceId: process.env.IMPEL_RUN_TRACE_ID ?? process.env.IMPEL_RUN_ID,
        agent: process.env.IMPEL_RUN_AGENT
            ? safeJsonObject(process.env.IMPEL_RUN_AGENT)
            : undefined,
    };
}
function safeCallOptions(options) {
    const { temperature, maxOutputTokens, topP, topK, presencePenalty, frequencyPenalty, stopSequences, seed, responseFormat, } = options;
    return {
        temperature,
        maxOutputTokens,
        topP,
        topK,
        presencePenalty,
        frequencyPenalty,
        stopSequences,
        seed,
        responseFormat,
    };
}
function requireConfigured(name, value) {
    if (value && value.trim() !== "")
        return value;
    throw new Error(`${name} is required to call impel-inference. Set it explicitly or configure ${name}.`);
}
export function impelInference(modelId, opts) {
    const constructorProviderOptions = opts?.providerOptions ?? {};
    const label = opts?.label ?? "impel-inference";
    const streamReasoning = opts?.streamReasoning === true;
    async function doStream(options) {
        const baseUrl = requireConfigured("IMPEL_INFERENCE_URL", opts?.baseUrl ?? process.env.IMPEL_INFERENCE_URL).replace(/\/$/, "");
        const apiKey = requireConfigured("IMPEL_INFERENCE_API_KEY", opts?.apiKey ?? process.env.IMPEL_INFERENCE_API_KEY);
        const configuredRunContext = await resolveConfiguredRunContext(opts?.runContext);
        const promptRunContext = extractRunContextFromPrompt(options.prompt);
        const fallbackRunContext = envRunContext();
        const orgId = promptRunContext?.orgId ??
            configuredRunContext?.orgId ??
            opts?.orgId ??
            process.env.IMPEL_ORG_ID ??
            "default";
        const repos = promptRunContext?.repos ??
            configuredRunContext?.repos ??
            fallbackRunContext.repos;
        const branch = promptRunContext?.branch ??
            configuredRunContext?.branch ??
            fallbackRunContext.branch;
        const installationId = promptRunContext?.installationId ??
            configuredRunContext?.installationId ??
            fallbackRunContext.installationId;
        const runId = promptRunContext?.runId ??
            configuredRunContext?.runId ??
            fallbackRunContext.runId;
        const traceId = promptRunContext?.traceId ??
            configuredRunContext?.traceId ??
            fallbackRunContext.traceId ??
            runId;
        const agent = promptRunContext?.agent ??
            configuredRunContext?.agent ??
            fallbackRunContext.agent;
        const body = {
            provider: opts?.provider ?? "claude-code",
            modelId,
            prompt: options.prompt,
            providerOptions: {
                ...(options.providerOptions ?? {}),
                ...constructorProviderOptions,
            },
            callOptions: safeCallOptions(options),
            orgId,
            repos,
            branch,
            installationId,
            trace: traceId
                ? {
                    traceId,
                    runId,
                    agent,
                }
                : undefined,
        };
        const headers = await inferenceHeaders({
            apiKey,
            orgId,
            extraHeaders: opts?.headers,
        });
        async function createInferenceRun() {
            try {
                return await startInferenceStream({ baseUrl, headers, body, orgId });
            }
            catch (error) {
                if (!(error instanceof StartEndpointUnavailableError))
                    throw error;
                return await openInferenceStream({
                    url: `${baseUrl}/v1/infer`,
                    headers,
                    body,
                    method: "POST",
                });
            }
        }
        const initial = await createInferenceRun();
        let sawStreamStart = false;
        let sawUpstreamPart = false;
        let sawOutputPart = false;
        let sawUserVisibleOutput = false;
        let sawProviderError = false;
        let pendingFinish;
        let upstreamPartCount = 0;
        let inferenceRunId = initial.runId;
        const maxResumeAttempts = envNumber("IMPEL_INFERENCE_RESUME_MAX_ATTEMPTS", 20);
        const resumeDelayMs = envNumber("IMPEL_INFERENCE_RESUME_DELAY_MS", 1000);
        const maxParseResumeAttempts = envNumber("IMPEL_INFERENCE_PARSE_RESUME_MAX_ATTEMPTS", 3);
        const maxTransientAttempts = envNumber("IMPEL_INFERENCE_TRANSIENT_MAX_ATTEMPTS", 2);
        const transientDelayMs = envNumber("IMPEL_INFERENCE_TRANSIENT_RETRY_DELAY_MS", 1500);
        let upstreamReader;
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue({ type: "stream-start", warnings: [] });
                sawStreamStart = true;
                void (async () => {
                    let current = initial;
                    let resumeStartIndex = initial.nextStartIndex ?? 0;
                    let skipAlreadySeen = 0;
                    let resumeAttempts = 0;
                    let parseResumeAttempts = 0;
                    let lastParseResumeStartIndex;
                    let transientAttempts = 0;
                    let heldTextParts = [];
                    let heldText = "";
                    let holdingApiErrorText = false;
                    function enqueuePart(part) {
                        sawOutputPart = true;
                        if (isUserVisibleStreamPart(part))
                            sawUserVisibleOutput = true;
                        controller.enqueue(part);
                    }
                    function flushHeldTextParts() {
                        for (const heldPart of heldTextParts)
                            enqueuePart(heldPart);
                        heldTextParts = [];
                        heldText = "";
                        holdingApiErrorText = false;
                    }
                    function clearHeldTextParts() {
                        heldTextParts = [];
                        heldText = "";
                        holdingApiErrorText = false;
                    }
                    try {
                        for (;;) {
                            upstreamReader = current.stream.getReader();
                            let streamClosed = false;
                            let partsSeenThisConnection = 0;
                            let retryTransient = false;
                            let retryResume = false;
                            const hasServiceCursor = current.nextStartIndex !== undefined;
                            try {
                                for (;;) {
                                    const { done, value: chunk } = await upstreamReader.read();
                                    if (done) {
                                        streamClosed = true;
                                        break;
                                    }
                                    if (partsSeenThisConnection++ < skipAlreadySeen)
                                        continue;
                                    upstreamPartCount += 1;
                                    if (!chunk.success) {
                                        if (isJsonParseStreamError(chunk.error) &&
                                            inferenceRunId &&
                                            hasServiceCursor &&
                                            parseResumeAttempts < maxParseResumeAttempts &&
                                            lastParseResumeStartIndex !== resumeStartIndex &&
                                            resumeAttempts < maxResumeAttempts) {
                                            retryResume = true;
                                            break;
                                        }
                                        const transient = isTransientProviderError({
                                            error: chunk.error,
                                            heldText,
                                        });
                                        if (transient &&
                                            (!sawUserVisibleOutput || holdingApiErrorText) &&
                                            transientAttempts < maxTransientAttempts) {
                                            retryTransient = true;
                                            break;
                                        }
                                        const partialOutput = heldText;
                                        flushHeldTextParts();
                                        sawProviderError = true;
                                        enqueuePart({
                                            type: "error",
                                            error: errorFromUnknown(chunk.error, "impel-inference stream parse error", { partialOutput }),
                                        });
                                        continue;
                                    }
                                    sawUpstreamPart = true;
                                    const part = redactStreamPart(chunk.value);
                                    if (!streamReasoning && isReasoningStreamPart(part)) {
                                        continue;
                                    }
                                    if (part.type === "stream-start") {
                                        if (sawStreamStart)
                                            continue;
                                        sawStreamStart = true;
                                    }
                                    else if (part.type === "finish") {
                                        const rejection = rejectedFinishMessage({
                                            part,
                                            runId: inferenceRunId,
                                            label,
                                        });
                                        if (rejection) {
                                            flushHeldTextParts();
                                            sawProviderError = true;
                                            enqueuePart(errorPart(rejection));
                                            controller.close();
                                            return;
                                        }
                                        pendingFinish = part;
                                        continue;
                                    }
                                    if (part.type === "text-start" && !sawUserVisibleOutput) {
                                        heldTextParts.push(part);
                                        continue;
                                    }
                                    if (heldTextParts.length > 0 && part.type === "text-delta") {
                                        heldTextParts.push(part);
                                        heldText += part.delta;
                                        const state = transientErrorTextState(heldText);
                                        if (state === "match") {
                                            holdingApiErrorText = true;
                                            continue;
                                        }
                                        if (state === "possible")
                                            continue;
                                        flushHeldTextParts();
                                        continue;
                                    }
                                    if (heldTextParts.length > 0 && part.type === "text-end") {
                                        heldTextParts.push(part);
                                        if (holdingApiErrorText)
                                            continue;
                                        flushHeldTextParts();
                                        continue;
                                    }
                                    if (part.type === "error") {
                                        const transient = isTransientProviderError({
                                            error: part.error,
                                            heldText,
                                        });
                                        if (transient &&
                                            (!sawUserVisibleOutput || holdingApiErrorText) &&
                                            transientAttempts < maxTransientAttempts) {
                                            retryTransient = true;
                                            break;
                                        }
                                        const partialOutput = heldText;
                                        flushHeldTextParts();
                                        sawProviderError = true;
                                        enqueuePart({
                                            ...part,
                                            error: errorFromUnknown(part.error, "impel-inference provider error", { partialOutput }),
                                        });
                                        continue;
                                    }
                                    flushHeldTextParts();
                                    enqueuePart(part);
                                }
                            }
                            finally {
                                upstreamReader.releaseLock();
                                upstreamReader = undefined;
                            }
                            if (retryTransient) {
                                transientAttempts += 1;
                                clearHeldTextParts();
                                pendingFinish = undefined;
                                sawProviderError = false;
                                upstreamPartCount = 0;
                                skipAlreadySeen = 0;
                                resumeAttempts = 0;
                                parseResumeAttempts = 0;
                                lastParseResumeStartIndex = undefined;
                                await sleep(transientDelayMs * transientAttempts);
                                const restarted = await createInferenceRun();
                                inferenceRunId = restarted.runId;
                                current = restarted;
                                continue;
                            }
                            if (retryResume && inferenceRunId) {
                                const runId = inferenceRunId;
                                resumeAttempts += 1;
                                parseResumeAttempts += 1;
                                await sleep(resumeDelayMs * Math.min(resumeAttempts, 5));
                                const startIndex = resumeStartIndex;
                                lastParseResumeStartIndex = startIndex;
                                skipAlreadySeen = startIndex === 0 ? upstreamPartCount : 0;
                                const resumed = await openInferenceStream({
                                    url: `${baseUrl}/v1/infer/runs/` +
                                        `${encodeURIComponent(runId)}/stream?startIndex=${startIndex}` +
                                        `&orgId=${encodeURIComponent(orgId)}`,
                                    headers,
                                });
                                inferenceRunId = resumed.runId ?? runId;
                                resumeStartIndex = resumed.nextStartIndex ?? startIndex;
                                current = resumed;
                                continue;
                            }
                            if (pendingFinish) {
                                flushHeldTextParts();
                                controller.enqueue(pendingFinish);
                                controller.close();
                                return;
                            }
                            if (sawProviderError) {
                                controller.close();
                                return;
                            }
                            if (!streamClosed)
                                continue;
                            if (inferenceRunId &&
                                resumeAttempts < maxResumeAttempts &&
                                !pendingFinish) {
                                resumeAttempts += 1;
                                await sleep(resumeDelayMs);
                                const startIndex = resumeStartIndex;
                                skipAlreadySeen = startIndex === 0 ? upstreamPartCount : 0;
                                const resumed = await openInferenceStream({
                                    url: `${baseUrl}/v1/infer/runs/` +
                                        `${encodeURIComponent(inferenceRunId)}/stream?startIndex=${startIndex}` +
                                        `&orgId=${encodeURIComponent(orgId)}`,
                                    headers,
                                });
                                inferenceRunId = resumed.runId ?? inferenceRunId;
                                resumeStartIndex = resumed.nextStartIndex ?? startIndex;
                                current = resumed;
                                continue;
                            }
                            throw new Error((sawUpstreamPart
                                ? "impel-inference stream closed before a successful finish event; "
                                : "impel-inference stream closed before emitting any provider events; ") +
                                "check upstream timeout, provider credentials, and sandbox startup logs.");
                        }
                    }
                    catch (error) {
                        controller.error(redactedError(error));
                    }
                })();
            },
            cancel(reason) {
                return upstreamReader?.cancel(reason);
            },
        });
        return { stream, request: { body } };
    }
    async function doGenerate(options) {
        const { stream } = await doStream(options);
        const content = [];
        const textById = new Map();
        const reasoningById = new Map();
        let warnings = [];
        let finishReason = {
            unified: "other",
            raw: undefined,
        };
        let usage = {
            inputTokens: {
                total: undefined,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
            },
            outputTokens: { total: undefined, text: undefined, reasoning: undefined },
        };
        const reader = stream.getReader();
        try {
            for (;;) {
                const { done, value: part } = await reader.read();
                if (done)
                    break;
                switch (part.type) {
                    case "stream-start":
                        warnings = part.warnings;
                        break;
                    case "text-start":
                        textById.set(part.id, {
                            index: content.push({ type: "text", text: "" }) - 1,
                            text: "",
                        });
                        break;
                    case "text-delta": {
                        const entry = textById.get(part.id);
                        if (entry) {
                            entry.text += part.delta;
                            content[entry.index] = { type: "text", text: entry.text };
                        }
                        break;
                    }
                    case "reasoning-start":
                        reasoningById.set(part.id, {
                            index: content.push({ type: "reasoning", text: "" }) - 1,
                            text: "",
                        });
                        break;
                    case "reasoning-delta": {
                        const entry = reasoningById.get(part.id);
                        if (entry) {
                            entry.text += part.delta;
                            content[entry.index] = { type: "reasoning", text: entry.text };
                        }
                        break;
                    }
                    case "tool-call":
                    case "tool-result":
                    case "file":
                    case "source":
                        content.push(part);
                        break;
                    case "finish":
                        finishReason = part.finishReason;
                        usage = part.usage;
                        break;
                    case "error":
                        throw errorFromUnknown(part.error, "impel-inference provider error", { partialOutput: textContent(content) });
                    default:
                        break;
                }
            }
        }
        finally {
            reader.releaseLock();
        }
        return { content, finishReason, usage, warnings };
    }
    return {
        specificationVersion: "v3",
        provider: "impel-inference",
        modelId,
        supportedUrls: {},
        doGenerate,
        doStream,
    };
}
//# sourceMappingURL=index.js.map