import type { LanguageModel } from "ai";
import type { SharedV4ProviderOptions } from "@ai-sdk/provider";
import {
  impelGatewayModel,
  type ImpelGatewayHeaders,
  type ImpelGatewayModelOptions,
  type ImpelGatewayRunContextProvider,
} from "../gateway-model.js";

type JsonObject = Record<string, unknown>;

const ANTHROPIC_PROVIDER_OPTION_KEYS = new Set([
  "sendReasoning",
  "structuredOutputMode",
  "thinking",
  "disableParallelToolUse",
  "cacheControl",
  "metadata",
  "mcpServers",
  "container",
  "toolStreaming",
  "effort",
  "taskBudget",
  "speed",
  "inferenceGeo",
  "fallbacks",
  "anthropicBeta",
  "contextManagement",
]);

const OPENAI_PROVIDER_OPTION_KEYS = new Set([
  "conversation",
  "include",
  "instructions",
  "logprobs",
  "maxToolCalls",
  "metadata",
  "parallelToolCalls",
  "previousResponseId",
  "promptCacheKey",
  "promptCacheRetention",
  "reasoningEffort",
  "reasoningSummary",
  "safetyIdentifier",
  "serviceTier",
  "store",
  "passThroughUnsupportedFiles",
  "strictJsonSchema",
  "textVerbosity",
  "truncation",
  "user",
  "systemMessageMode",
  "forceReasoning",
  "contextManagement",
  "allowedTools",
]);

export const IMPEL_CLAUDE_CONTEXT_WINDOW_TOKENS = 200000;
export const IMPEL_DEFAULT_CLAUDE_MODEL_ID = "claude-opus-4-8";
export const IMPEL_CODEX_CONTEXT_WINDOW_TOKENS = 200000;
export const IMPEL_DEFAULT_CODEX_MODEL_ID = "gpt-5.5";
export const IMPEL_DEFAULT_OPENAI_RESPONSES_MODEL_ID =
  IMPEL_DEFAULT_CODEX_MODEL_ID;

export interface ImpelClaudeProviderOptionsInput {
  providerOptions?: Record<string, unknown>;
  /** @deprecated The API provider does not launch a local harness. */
  localProviderOptions?: Record<string, unknown>;
  /** @deprecated Permissions are owned by Eve's sandbox. */
  permissionMode?: string;
  /** @deprecated Permissions are owned by Eve's sandbox. */
  allowDangerouslySkipPermissions?: boolean;
  effort?: string;
  /** @deprecated Working directories are owned by Eve's sandbox. */
  cwd?: string;
}

export interface ImpelClaudeModelOptions
  extends ImpelClaudeProviderOptionsInput {
  modelId?: string;
  defaultModelId?: string;
  gatewayUrl?: string;
  authToken?: string;
  /** @deprecated Use authToken. */
  gatewayAuthToken?: string;
  /** @deprecated Use authToken. */
  gatewayPat?: string;
  headers?: ImpelGatewayHeaders;
  runContext?: ImpelGatewayRunContextProvider;
  fetch?: typeof globalThis.fetch;
  /** @deprecated The v1 model has no implicit local-provider fallback. */
  localModel?: string;
  /** @deprecated The v1 model has no implicit local-provider fallback. */
  defaultLocalModel?: string;
  /** @deprecated The v1 model has no implicit local-provider fallback. */
  allowLocalProviderFallback?: boolean;
  /** @deprecated The archived inference service is no longer supported. */
  baseUrl?: string;
  /** @deprecated The archived inference service is no longer supported. */
  apiKey?: string;
  /** @deprecated Org identity comes from the signed run token. */
  orgId?: string;
  /** @deprecated This model always uses the conventional gateway API. */
  provider?: string;
  /** @deprecated Retained as a no-op compatibility field. */
  label?: string;
  /** @deprecated Retained as a no-op compatibility field. */
  streamReasoning?: boolean;
}

export interface ImpelCodexProviderOptionsInput {
  providerOptions?: Record<string, unknown>;
  /** @deprecated Permissions are owned by Eve's sandbox. */
  approvalMode?: string;
  /** @deprecated Permissions are owned by Eve's sandbox. */
  sandboxMode?: string;
  /** @deprecated The API provider does not launch a local harness. */
  skipGitRepoCheck?: boolean;
  effort?: string;
}

export interface ImpelCodexModelOptions
  extends ImpelCodexProviderOptionsInput {
  modelId?: string;
  defaultModelId?: string;
  gatewayUrl?: string;
  authToken?: string;
  /** @deprecated Use authToken. */
  gatewayAuthToken?: string;
  /** @deprecated Use authToken. */
  gatewayPat?: string;
  headers?: ImpelGatewayHeaders;
  runContext?: ImpelGatewayRunContextProvider;
  fetch?: typeof globalThis.fetch;
  /** @deprecated The archived inference service is no longer supported. */
  baseUrl?: string;
  /** @deprecated The archived inference service is no longer supported. */
  apiKey?: string;
  /** @deprecated Org identity comes from the signed run token. */
  orgId?: string;
  /** @deprecated Retained as a no-op compatibility field. */
  label?: string;
}

export type ImpelOpenAIResponsesModelOptions = ImpelCodexModelOptions;

export function resolveImpelModelId(
  envNames: readonly string[],
  defaultModelId: string,
): string {
  for (const name of envNames) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return defaultModelId;
}

export function resolveImpelClaudeModelId({
  modelId,
  defaultModelId = IMPEL_DEFAULT_CLAUDE_MODEL_ID,
}: {
  modelId?: string;
  defaultModelId?: string;
} = {}): string {
  return modelId ?? resolveImpelModelId(["IMPEL_MODEL_ID"], defaultModelId);
}

export function resolveImpelCodexModelId({
  modelId,
  defaultModelId = IMPEL_DEFAULT_CODEX_MODEL_ID,
}: {
  modelId?: string;
  defaultModelId?: string;
} = {}): string {
  return (
    modelId ?? resolveImpelModelId(["IMPEL_CODEX_MODEL_ID"], defaultModelId)
  );
}

export function resolveImpelOpenAIResponsesModelId({
  modelId,
  defaultModelId = IMPEL_DEFAULT_OPENAI_RESPONSES_MODEL_ID,
}: {
  modelId?: string;
  defaultModelId?: string;
} = {}): string {
  return (
    modelId ??
    resolveImpelModelId(
      ["IMPEL_OPENAI_RESPONSES_MODEL_ID", "IMPEL_CODEX_MODEL_ID"],
      defaultModelId,
    )
  );
}

/** @deprecated Pass AI SDK providerOptions directly to createImpelClaudeModel. */
export function createImpelClaudeProviderOptions({
  providerOptions,
  effort,
}: ImpelClaudeProviderOptionsInput = {}): Record<string, unknown> {
  return normalizeProviderOptions("anthropic", providerOptions, effort);
}

/** @deprecated Pass AI SDK providerOptions directly to createImpelCodexModel. */
export function createImpelCodexProviderOptions({
  providerOptions,
  effort,
}: ImpelCodexProviderOptionsInput = {}): Record<string, unknown> {
  return normalizeProviderOptions("openai", providerOptions, effort);
}

/**
 * Backward-compatible name for the default pure-Eve gateway model.
 * No environment-dependent provider or local harness fallback remains.
 */
export function createImpelClaudeModel(
  options: ImpelClaudeModelOptions = {},
): LanguageModel {
  const modelId = resolveImpelClaudeModelId(options);
  return impelGatewayModel(modelId, gatewayOptions(options, "anthropic"));
}

/** Backward-compatible OpenAI Responses/Codex gateway model factory. */
export function createImpelCodexModel(
  options: ImpelCodexModelOptions = {},
): LanguageModel {
  const modelId = resolveImpelCodexModelId(options);
  return impelGatewayModel(modelId, gatewayOptions(options, "openai"));
}

export function createImpelOpenAIResponsesModel(
  options: ImpelOpenAIResponsesModelOptions = {},
): LanguageModel {
  return createImpelCodexModel({
    ...options,
    modelId: resolveImpelOpenAIResponsesModelId(options),
  });
}

function gatewayOptions(
  options: ImpelClaudeModelOptions | ImpelCodexModelOptions,
  provider: "anthropic" | "openai",
): ImpelGatewayModelOptions {
  return {
    gatewayUrl: options.gatewayUrl,
    authToken:
      options.authToken ?? options.gatewayAuthToken ?? options.gatewayPat,
    headers: options.headers,
    runContext: options.runContext,
    fetch: options.fetch,
    providerOptions: normalizeProviderOptions(
      provider,
      options.providerOptions,
      options.effort,
    ),
  };
}

function normalizeProviderOptions(
  provider: "anthropic" | "openai",
  options: Record<string, unknown> | undefined,
  effort: string | undefined,
): SharedV4ProviderOptions {
  const source = options ?? {};
  const aliases =
    provider === "anthropic"
      ? ["anthropic", "claude", "claude_code", "claude-code"]
      : ["openai", "codex", "codex_cli", "codex-app-server"];
  const allowedKeys =
    provider === "anthropic"
      ? ANTHROPIC_PROVIDER_OPTION_KEYS
      : OPENAI_PROVIDER_OPTION_KEYS;
  const providerOptions: JsonObject = {
    ...(effort
      ? provider === "anthropic"
        ? { effort }
        : { reasoningEffort: effort }
      : {}),
  };
  for (const alias of aliases) {
    const scoped = source[alias];
    if (isJsonObject(scoped)) Object.assign(providerOptions, scoped);
  }
  for (const [key, value] of Object.entries(source)) {
    if (allowedKeys.has(key)) providerOptions[key] = value;
  }
  return Object.keys(providerOptions).length
    ? ({ [provider]: providerOptions } as SharedV4ProviderOptions)
    : {};
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
