import {
  parseJsonEventStream,
  type ParseResult,
} from "@ai-sdk/provider-utils";
import { z } from "zod";
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
  SharedV3Warning,
} from "@ai-sdk/provider";

export interface ImpelInferenceRunContext {
  orgId?: string;
  repos?: string[];
  branch?: string;
  installationId?: string | number;
  runId?: string;
  traceId?: string;
  agent?: Record<string, unknown>;
}

export type ImpelInferenceHeaders =
  | HeadersInit
  | (() => HeadersInit | Promise<HeadersInit>);

export type ImpelInferenceRunContextProvider =
  | ImpelInferenceRunContext
  | (() => ImpelInferenceRunContext | Promise<ImpelInferenceRunContext>);

export interface ImpelInferenceOptions {
  baseUrl?: string;
  apiKey?: string;
  orgId?: string;
  /**
   * Provider construction options for the provider reconstructed inside
   * impel-inference, for example claudeCode permissionMode, maxTurns, agents,
   * and effort.
   */
  providerOptions?: Record<string, unknown>;
  /**
   * Additional request headers, evaluated per model call. Useful for W3C trace
   * headers. authorization, content-type, and x-org-id are always controlled by
   * this package and cannot be overridden here.
   */
  headers?: ImpelInferenceHeaders;
  /**
   * Optional explicit run context for non-Eve callers. Eve clientContext still
   * wins when present because it is per-turn.
   */
  runContext?: ImpelInferenceRunContextProvider;
  /**
   * Diagnostic label used in rejection errors.
   */
  label?: string;
  /**
   * Forwarded for future service routing. The current impel-inference service
   * selects the concrete CLI provider from modelId.
   */
  provider?: string;
}

const streamPartSchema = z.object({ type: z.string() }).passthrough();
const errorSchema = z
  .object({ error: z.object({ message: z.string() }).passthrough() })
  .passthrough();

type ParsedStreamPart = z.infer<typeof streamPartSchema>;

interface InferenceStream {
  stream: ReadableStream<ParseResult<ParsedStreamPart>>;
  runId?: string;
}

class StartEndpointUnavailableError extends Error {}

const CLIENT_CONTEXT_SENTINEL = "Client context:\n";

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function redactString(value: string): string {
  return value
    .replace(
      /(https?:\/\/)(x-access-token:)[^@\s/]+@/gi,
      "$1$2<redacted>@",
    )
    .replace(/(x-access-token:)[^@\s]+@/gi, "$1<redacted>@")
    .replace(
      /(https?:\/\/)[^/\s:@]+:[^@\s/]+@github\.com/gi,
      "$1<redacted>:<redacted>@github.com",
    )
    .replace(
      /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
      "<github-token>",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer <redacted>")
    .replace(/\bBasic\s+[A-Za-z0-9+/=]+/gi, "Basic <redacted>");
}

function redactSecrets(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") return value;

  if (value instanceof Error) {
    const error = new Error(redactString(value.message));
    error.name = value.name;
    return error;
  }

  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      redactSecrets(item, seen),
    ]),
  );
}

function redactStreamPart(part: ParsedStreamPart): LanguageModelV3StreamPart {
  return redactSecrets(part) as LanguageModelV3StreamPart;
}

function redactedError(error: unknown): unknown {
  return redactSecrets(error);
}

function headersInitToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  return Object.fromEntries(new Headers(headers).entries());
}

async function resolveExtraHeaders(
  headers: ImpelInferenceHeaders | undefined,
): Promise<Record<string, string>> {
  if (!headers) return {};
  const resolved = typeof headers === "function" ? await headers() : headers;
  return headersInitToRecord(resolved);
}

async function inferenceHeaders({
  apiKey,
  orgId,
  extraHeaders,
}: {
  apiKey: string;
  orgId: string;
  extraHeaders?: ImpelInferenceHeaders;
}): Promise<Record<string, string>> {
  return {
    ...(await resolveExtraHeaders(extraHeaders)),
    authorization: `Bearer ${apiKey}`,
    "x-org-id": orgId,
    "content-type": "application/json",
  };
}

async function inferenceResponseError(response: Response): Promise<Error> {
  const body = await response.text().catch(() => "");
  let message = body;
  try {
    const parsed = errorSchema.safeParse(JSON.parse(body));
    if (parsed.success) message = parsed.data.error.message;
  } catch {
    // Keep the raw body as the fallback message.
  }
  return new Error(
    `impel-inference request failed: HTTP ${response.status} ${redactString(message).slice(0, 1000)}`,
  );
}

async function openInferenceStream({
  url,
  headers,
  body,
  method = "GET",
}: {
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  method?: "GET" | "POST";
}): Promise<InferenceStream> {
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) throw await inferenceResponseError(response);
  if (!response.body) {
    throw new Error("impel-inference response had no stream body");
  }

  return {
    stream: parseJsonEventStream({
      stream: response.body,
      schema: streamPartSchema,
    }),
    runId: response.headers.get("x-workflow-run-id") ?? undefined,
  };
}

async function startInferenceStream({
  baseUrl,
  headers,
  body,
}: {
  baseUrl: string;
  headers: Record<string, string>;
  body: unknown;
}): Promise<InferenceStream> {
  const response = await fetch(`${baseUrl}/v1/infer/start`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (response.status === 404 || response.status === 405) {
    throw new StartEndpointUnavailableError(
      "impel-inference /v1/infer/start is unavailable",
    );
  }
  if (!response.ok) throw await inferenceResponseError(response);

  const payload = (await response.json().catch(() => undefined)) as
    | { runId?: unknown; streamUrl?: unknown }
    | undefined;
  const runId =
    typeof payload?.runId === "string"
      ? payload.runId
      : response.headers.get("x-workflow-run-id") ?? undefined;
  if (!runId) {
    throw new Error("impel-inference /v1/infer/start returned no runId");
  }

  const streamUrl = new URL(
    typeof payload?.streamUrl === "string"
      ? payload.streamUrl
      : `/v1/infer/runs/${encodeURIComponent(runId)}/stream`,
    `${baseUrl}/`,
  );
  if (!streamUrl.searchParams.has("startIndex")) {
    streamUrl.searchParams.set("startIndex", "0");
  }
  const stream = await openInferenceStream({ url: streamUrl.toString(), headers });
  return { stream: stream.stream, runId: stream.runId ?? runId };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function providerMetadata(
  part: LanguageModelV3StreamPart,
  provider: string,
): Record<string, unknown> | undefined {
  const metadata =
    "providerMetadata" in part ? part.providerMetadata : undefined;
  const scoped = metadata?.[provider];
  return scoped && typeof scoped === "object"
    ? (scoped as Record<string, unknown>)
    : undefined;
}

function rejectedFinishMessage({
  part,
  runId,
  label,
}: {
  part: LanguageModelV3StreamPart;
  runId: string | undefined;
  label: string;
}): string | undefined {
  if (part.type !== "finish") return undefined;

  const claude = providerMetadata(part, "claude-code");
  const codex = providerMetadata(part, "codex-cli");
  const metadata = claude ?? codex;
  const terminalReason =
    typeof metadata?.terminalReason === "string"
      ? metadata.terminalReason
      : undefined;
  const raw = part.finishReason.raw ?? "";
  const runSuffix = runId ? ` (impel-inference run ${runId})` : "";

  if (
    metadata?.truncated === true ||
    /truncat/i.test(raw) ||
    terminalReason === "truncated"
  ) {
    return (
      "impel-inference returned a truncated provider stream; " +
      `refusing to mark partial ${label} output successful${runSuffix}.`
    );
  }

  if (
    part.finishReason.unified === "length" ||
    part.finishReason.unified === "error" ||
    part.finishReason.unified === "content-filter" ||
    terminalReason === "max_turns"
  ) {
    return (
      `impel-inference ended with finishReason=${part.finishReason.unified}` +
      `${raw ? ` raw=${raw}` : ""}` +
      `${terminalReason ? ` terminalReason=${terminalReason}` : ""}; ` +
      `refusing to treat the ${label} turn as complete${runSuffix}.`
    );
  }

  if (part.finishReason.unified === "other" && terminalReason !== "completed") {
    return (
      `impel-inference ended with non-success finishReason=other` +
      `${raw ? ` raw=${raw}` : ""}` +
      `${terminalReason ? ` terminalReason=${terminalReason}` : ""}; ` +
      `refusing to treat the ${label} turn as complete${runSuffix}.`
    );
  }

  return undefined;
}

function errorPart(message: string): LanguageModelV3StreamPart {
  return { type: "error", error: new Error(redactString(message)) };
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Array<{ type?: string; text?: string }>)
      .filter((p) => p?.type === "text" && typeof p.text === "string")
      .map((p) => p.text ?? "")
      .join("");
  }
  return "";
}

function safeJsonObject(raw: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizeRunContext(
  obj: Record<string, unknown>,
): ImpelInferenceRunContext | null {
  const orgId = typeof obj.orgId === "string" ? obj.orgId : undefined;
  const repos =
    Array.isArray(obj.repos) && obj.repos.every((r) => typeof r === "string")
      ? (obj.repos as string[])
      : undefined;
  const branch = typeof obj.branch === "string" ? obj.branch : undefined;
  const installationId =
    typeof obj.installationId === "string"
      ? obj.installationId
      : typeof obj.installationId === "number" &&
          Number.isFinite(obj.installationId)
        ? String(obj.installationId)
        : undefined;
  const runId = typeof obj.runId === "string" ? obj.runId : undefined;
  const traceId = typeof obj.traceId === "string" ? obj.traceId : undefined;
  const agent =
    obj.agent && typeof obj.agent === "object"
      ? (obj.agent as Record<string, unknown>)
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

function extractRunContextFromPrompt(
  prompt: LanguageModelV3CallOptions["prompt"],
): ImpelInferenceRunContext | null {
  for (const msg of prompt) {
    if (msg.role !== "user" && msg.role !== "system") continue;

    const raw = messageContentToText(msg.content);
    if (raw === "") continue;
    const text = raw.replace(/^\s+/, "");
    if (!text.startsWith(CLIENT_CONTEXT_SENTINEL)) continue;

    const payload = text.slice(CLIENT_CONTEXT_SENTINEL.length);
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch (err) {
      console.warn(
        "[impel-inference-provider] clientContext sentinel present but JSON.parse failed; " +
          "repos will be undefined on the /v1/infer call (run may execute in an " +
          `empty workspace). error=${String(err)} payload=${JSON.stringify(payload.slice(0, 200))}`,
      );
      return null;
    }

    if (parsed === null || typeof parsed !== "object") {
      console.warn(
        "[impel-inference-provider] clientContext sentinel parsed to a non-object; " +
          "repos will be undefined on the /v1/infer call.",
      );
      return null;
    }

    const context = normalizeRunContext(parsed as Record<string, unknown>);
    if (!context?.repos?.length) {
      console.warn(
        "[impel-inference-provider] clientContext sentinel parsed but yielded no repos; " +
          "repos will be undefined on the /v1/infer call (run may execute in an " +
          `empty workspace). parsedKeys=${JSON.stringify(Object.keys(parsed as Record<string, unknown>))}`,
      );
    }
    return context;
  }
  return null;
}

async function resolveConfiguredRunContext(
  runContext: ImpelInferenceRunContextProvider | undefined,
): Promise<ImpelInferenceRunContext | null> {
  if (!runContext) return null;
  return typeof runContext === "function" ? await runContext() : runContext;
}

function envRunContext(): ImpelInferenceRunContext {
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

function safeCallOptions(options: LanguageModelV3CallOptions) {
  const {
    temperature,
    maxOutputTokens,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    stopSequences,
    seed,
    responseFormat,
  } = options;
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

function requireConfigured(name: string, value: string | undefined): string {
  if (value && value.trim() !== "") return value;
  throw new Error(
    `${name} is required to call impel-inference. Set it explicitly or configure ${name}.`,
  );
}

export function impelInference(
  modelId: string,
  opts?: ImpelInferenceOptions,
): LanguageModelV3 {
  const constructorProviderOptions = opts?.providerOptions ?? {};
  const label = opts?.label ?? "impel-inference";

  async function doStream(options: LanguageModelV3CallOptions) {
    const baseUrl = requireConfigured(
      "IMPEL_INFERENCE_URL",
      opts?.baseUrl ?? process.env.IMPEL_INFERENCE_URL,
    ).replace(/\/$/, "");
    const apiKey = requireConfigured(
      "IMPEL_INFERENCE_API_KEY",
      opts?.apiKey ?? process.env.IMPEL_INFERENCE_API_KEY,
    );
    const configuredRunContext = await resolveConfiguredRunContext(
      opts?.runContext,
    );
    const promptRunContext = extractRunContextFromPrompt(options.prompt);
    const fallbackRunContext = envRunContext();

    const orgId =
      promptRunContext?.orgId ??
      configuredRunContext?.orgId ??
      opts?.orgId ??
      process.env.IMPEL_ORG_ID ??
      "default";
    const repos =
      promptRunContext?.repos ??
      configuredRunContext?.repos ??
      fallbackRunContext.repos;
    const branch =
      promptRunContext?.branch ??
      configuredRunContext?.branch ??
      fallbackRunContext.branch;
    const installationId =
      promptRunContext?.installationId ??
      configuredRunContext?.installationId ??
      fallbackRunContext.installationId;
    const runId =
      promptRunContext?.runId ??
      configuredRunContext?.runId ??
      fallbackRunContext.runId;
    const traceId =
      promptRunContext?.traceId ??
      configuredRunContext?.traceId ??
      fallbackRunContext.traceId ??
      runId;
    const agent =
      promptRunContext?.agent ??
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
    let initial: InferenceStream;
    try {
      initial = await startInferenceStream({ baseUrl, headers, body });
    } catch (error) {
      if (!(error instanceof StartEndpointUnavailableError)) throw error;
      initial = await openInferenceStream({
        url: `${baseUrl}/v1/infer`,
        headers,
        body,
        method: "POST",
      });
    }

    let sawStreamStart = false;
    let sawUpstreamPart = false;
    let sawOutputPart = false;
    let sawProviderError = false;
    let pendingFinish: LanguageModelV3StreamPart | undefined;
    let upstreamPartCount = 0;
    let inferenceRunId = initial.runId;
    const maxResumeAttempts = envNumber(
      "IMPEL_INFERENCE_RESUME_MAX_ATTEMPTS",
      20,
    );
    const resumeDelayMs = envNumber("IMPEL_INFERENCE_RESUME_DELAY_MS", 1000);

    let upstreamReader:
      | ReadableStreamDefaultReader<ParseResult<ParsedStreamPart>>
      | undefined;

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });
        sawStreamStart = true;

        void (async () => {
          let current = initial;
          let skipAlreadySeen = 0;
          let resumeAttempts = 0;

          try {
            for (;;) {
              upstreamReader = current.stream.getReader();
              let streamClosed = false;
              let partsSeenThisConnection = 0;

              try {
                for (;;) {
                  const { done, value: chunk } = await upstreamReader.read();
                  if (done) {
                    streamClosed = true;
                    break;
                  }

                  if (partsSeenThisConnection++ < skipAlreadySeen) continue;
                  upstreamPartCount += 1;

                  if (!chunk.success) {
                    sawOutputPart = true;
                    sawProviderError = true;
                    controller.enqueue({
                      type: "error",
                      error: redactedError(chunk.error),
                    });
                    continue;
                  }

                  sawUpstreamPart = true;
                  const part = redactStreamPart(chunk.value);
                  if (part.type === "stream-start") {
                    if (sawStreamStart) continue;
                    sawStreamStart = true;
                  } else if (part.type === "finish") {
                    const rejection = rejectedFinishMessage({
                      part,
                      runId: inferenceRunId,
                      label,
                    });
                    if (rejection) {
                      sawOutputPart = true;
                      sawProviderError = true;
                      controller.enqueue(errorPart(rejection));
                      controller.close();
                      return;
                    }
                    pendingFinish = part;
                    continue;
                  } else {
                    sawOutputPart = true;
                    if (part.type === "error") sawProviderError = true;
                  }
                  controller.enqueue(part);
                }
              } finally {
                upstreamReader.releaseLock();
                upstreamReader = undefined;
              }

              if (pendingFinish) {
                controller.enqueue(pendingFinish);
                controller.close();
                return;
              }

              if (sawProviderError) {
                controller.close();
                return;
              }

              if (!streamClosed) continue;

              if (
                inferenceRunId &&
                resumeAttempts < maxResumeAttempts &&
                !pendingFinish
              ) {
                resumeAttempts += 1;
                await sleep(resumeDelayMs);
                skipAlreadySeen = upstreamPartCount;
                const resumed = await openInferenceStream({
                  url:
                    `${baseUrl}/v1/infer/runs/` +
                    `${encodeURIComponent(inferenceRunId)}/stream?startIndex=0`,
                  headers,
                });
                inferenceRunId = resumed.runId ?? inferenceRunId;
                current = resumed;
                continue;
              }

              throw new Error(
                (sawUpstreamPart
                  ? "impel-inference stream closed before a successful finish event; "
                  : "impel-inference stream closed before emitting any provider events; ") +
                  "check upstream timeout, provider credentials, and sandbox startup logs.",
              );
            }
          } catch (error) {
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

  async function doGenerate(options: LanguageModelV3CallOptions) {
    const { stream } = await doStream(options);

    const content: LanguageModelV3Content[] = [];
    const textById = new Map<string, { index: number; text: string }>();
    const reasoningById = new Map<string, { index: number; text: string }>();
    let warnings: SharedV3Warning[] = [];
    let finishReason: LanguageModelV3FinishReason = {
      unified: "other",
      raw: undefined,
    };
    let usage: LanguageModelV3Usage = {
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
        if (done) break;
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
            content.push(part as LanguageModelV3Content);
            break;
          case "finish":
            finishReason = part.finishReason;
            usage = part.usage;
            break;
          case "error":
            throw part.error instanceof Error
              ? part.error
              : new Error(String(part.error));
          default:
            break;
        }
      }
    } finally {
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

export const impelSidecar = impelInference;
