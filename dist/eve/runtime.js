import { z } from "zod";
export const IMPEL_EVE_HEALTH_PATH = "/eve/v1/health";
export const IMPEL_EVE_SESSION_PATH = "/eve/v1/session";
export const impelRuntimeConfigSchema = z
    .object({
    version: z.number().int().positive().default(1),
    agent: z
        .object({
        id: z.string().min(1),
        label: z.string().optional(),
    })
        .passthrough(),
    eve: z
        .object({
        healthPath: z.string().default(IMPEL_EVE_HEALTH_PATH),
        sessionPath: z.string().default(IMPEL_EVE_SESSION_PATH),
    })
        .passthrough()
        .optional(),
})
    .passthrough();
export class ImpelRuntimeSmokeError extends Error {
    constructor(message) {
        super(message);
        this.name = "ImpelRuntimeSmokeError";
    }
}
function nonEmptyEnv(...names) {
    for (const name of names) {
        const value = process.env[name]?.trim();
        if (value)
            return value;
    }
    return undefined;
}
export async function smokeDeployedRuntime({ baseUrl, message = "Reply briefly: ready.", clientContext, timeoutMs = 120000, successOnText = false, basicUser = nonEmptyEnv("EVE_APP_BASIC_USER", "IMPEL_EVE_BASIC_USER"), basicPassword = nonEmptyEnv("EVE_APP_BASIC_PASSWORD", "IMPEL_EVE_BASIC_PASSWORD"), bearerToken, fetch: fetchImpl = fetch, log = () => { }, }) {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    if (!normalizedBaseUrl) {
        throw new ImpelRuntimeSmokeError("baseUrl is required");
    }
    const headers = { accept: "application/json" };
    if (bearerToken) {
        headers.authorization = `Bearer ${bearerToken}`;
    }
    else if (basicUser && basicPassword) {
        headers.authorization =
            "Basic " + Buffer.from(`${basicUser}:${basicPassword}`).toString("base64");
    }
    const sessionBody = { message };
    if (clientContext !== undefined)
        sessionBody.clientContext = clientContext;
    log(`[smoke] health ${normalizedBaseUrl}${IMPEL_EVE_HEALTH_PATH}`);
    await expectOk(fetchImpl(`${normalizedBaseUrl}${IMPEL_EVE_HEALTH_PATH}`, { headers }), "health");
    log("[smoke] create session");
    const sessionResponse = await expectOk(fetchImpl(`${normalizedBaseUrl}${IMPEL_EVE_SESSION_PATH}`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(sessionBody),
    }), "session create");
    const session = (await sessionResponse.json());
    if (!session.sessionId) {
        throw new ImpelRuntimeSmokeError(`session create response did not include sessionId: ${JSON.stringify(session)}`);
    }
    log(`[smoke] stream ${session.sessionId}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let eventCount = 0;
    let completed = false;
    let textBytes = 0;
    let sawEnoughText = false;
    try {
        const streamResponse = await expectOk(fetchImpl(`${normalizedBaseUrl}${IMPEL_EVE_SESSION_PATH}/${session.sessionId}/stream?startIndex=0`, {
            headers: { ...headers, accept: "application/x-ndjson" },
            signal: controller.signal,
        }), "session stream");
        const reader = streamResponse.body?.getReader();
        if (!reader) {
            throw new ImpelRuntimeSmokeError("session stream response had no body");
        }
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? "";
            for (const line of lines) {
                if (!line.trim())
                    continue;
                const event = handleSmokeEvent(line);
                eventCount += 1;
                completed ||= event.completed;
                textBytes += event.textBytes;
            }
            if (successOnText && textBytes > 0) {
                sawEnoughText = true;
                await reader.cancel();
                break;
            }
        }
        if (buffer.trim()) {
            const event = handleSmokeEvent(buffer);
            eventCount += 1;
            completed ||= event.completed;
            textBytes += event.textBytes;
        }
    }
    catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new ImpelRuntimeSmokeError(`session stream did not complete within ${timeoutMs}ms`);
        }
        throw error;
    }
    finally {
        clearTimeout(timeout);
    }
    if (eventCount === 0) {
        throw new ImpelRuntimeSmokeError("session stream produced no events");
    }
    if (!completed && textBytes === 0 && !sawEnoughText) {
        throw new ImpelRuntimeSmokeError("session stream ended without a completion event or assistant text");
    }
    return {
        sessionId: session.sessionId,
        eventCount,
        textBytes,
        completed,
    };
}
function handleSmokeEvent(line) {
    let event;
    try {
        event = JSON.parse(line);
    }
    catch {
        return { completed: false, textBytes: 0 };
    }
    const type = event && typeof event === "object" && "type" in event
        ? String(event.type)
        : "";
    if (containsUnredactedSecret(line)) {
        throw new ImpelRuntimeSmokeError("stream event contained an unredacted credential");
    }
    if (/error|failed/i.test(type)) {
        throw new ImpelRuntimeSmokeError(`stream error event: ${redactForLog(line).slice(0, 1000)}`);
    }
    for (const reason of finishReasons(event)) {
        if (["other", "length", "error", "content-filter"].includes(reason)) {
            throw new ImpelRuntimeSmokeError(`stream ended with non-success finishReason=${reason}`);
        }
    }
    if (/truncat/i.test(line)) {
        throw new ImpelRuntimeSmokeError(`stream contained truncation marker: ${redactForLog(line).slice(0, 1000)}`);
    }
    const data = event &&
        typeof event === "object" &&
        "data" in event &&
        event.data &&
        typeof event.data === "object"
        ? event.data
        : {};
    let textBytes = 0;
    for (const value of [
        valueAt(event, "delta"),
        valueAt(event, "messageDelta"),
        valueAt(data, "delta"),
        valueAt(data, "messageDelta"),
        valueAt(data, "messageSoFar"),
    ]) {
        if (typeof value === "string")
            textBytes += Buffer.byteLength(value);
    }
    return {
        completed: /completed|finished|done/i.test(type),
        textBytes,
    };
}
function valueAt(value, key) {
    return value && typeof value === "object" && key in value
        ? value[key]
        : undefined;
}
function finishReasons(value, reasons = []) {
    if (value === null || typeof value !== "object")
        return reasons;
    if (Array.isArray(value)) {
        for (const item of value)
            finishReasons(item, reasons);
        return reasons;
    }
    for (const [key, item] of Object.entries(value)) {
        if (key === "finishReason" && typeof item === "string") {
            reasons.push(item);
        }
        else {
            finishReasons(item, reasons);
        }
    }
    return reasons;
}
function containsUnredactedSecret(value) {
    return (/x-access-token:[^@\s]+@/i.test(value) ||
        /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/.test(value) ||
        /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i.test(value));
}
function redactForLog(value) {
    return value
        .replace(/(x-access-token:)[^@\s]+@/gi, "$1<redacted>@")
        .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "<github-token>")
        .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer <redacted>");
}
async function expectOk(responsePromise, label) {
    const response = await responsePromise;
    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new ImpelRuntimeSmokeError(`${label} failed: HTTP ${response.status} ${body.slice(0, 1000)}`);
    }
    return response;
}
//# sourceMappingURL=runtime.js.map