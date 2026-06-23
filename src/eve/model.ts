import type { LanguageModelV3 } from "@ai-sdk/provider";
import {
  claudeCode,
  type ClaudeCodeModelId,
  type ClaudeCodeSettings,
} from "ai-sdk-provider-claude-code";
import {
  impelInference,
  type ImpelInferenceHeaders,
  type ImpelInferenceOptions,
  type ImpelInferenceRunContextProvider,
} from "../index.js";

export const IMPEL_CLAUDE_CONTEXT_WINDOW_TOKENS = 200000;
export const IMPEL_DEFAULT_CLAUDE_MODEL_ID = "claude-opus-4-8";

export interface ImpelClaudeProviderOptionsInput {
  providerOptions?: ClaudeCodeSettings;
  permissionMode?: ClaudeCodeSettings["permissionMode"];
  allowDangerouslySkipPermissions?: boolean;
  effort?: ClaudeCodeSettings["effort"];
  cwd?: string;
}

export interface ImpelClaudeModelOptions
  extends Omit<ImpelInferenceOptions, "providerOptions">,
    ImpelClaudeProviderOptionsInput {
  modelId?: string;
  defaultModelId?: string;
  localModel?: ClaudeCodeModelId;
  defaultLocalModel?: ClaudeCodeModelId;
  headers?: ImpelInferenceHeaders;
  runContext?: ImpelInferenceRunContextProvider;
}

export function createImpelClaudeProviderOptions({
  providerOptions,
  permissionMode = "bypassPermissions",
  allowDangerouslySkipPermissions = true,
  effort,
  cwd,
}: ImpelClaudeProviderOptionsInput = {}): ClaudeCodeSettings {
  return {
    permissionMode,
    allowDangerouslySkipPermissions,
    ...(effort ? { effort } : {}),
    ...(providerOptions ?? {}),
    ...(cwd ? { cwd } : {}),
  };
}

export function resolveImpelClaudeModelId({
  modelId,
  defaultModelId = IMPEL_DEFAULT_CLAUDE_MODEL_ID,
}: {
  modelId?: string;
  defaultModelId?: string;
} = {}): string {
  return modelId ?? process.env.IMPEL_MODEL_ID ?? defaultModelId;
}

export function inferClaudeCodeLocalModel(
  modelId: string,
  fallback: ClaudeCodeModelId = "opus",
): ClaudeCodeModelId {
  if (/sonnet/i.test(modelId)) return "sonnet";
  if (/haiku/i.test(modelId)) return "haiku";
  return fallback;
}

export function createImpelClaudeModel(
  options: ImpelClaudeModelOptions = {},
): LanguageModelV3 {
  const {
    modelId: explicitModelId,
    defaultModelId,
    localModel,
    defaultLocalModel = "opus",
    providerOptions,
    permissionMode,
    allowDangerouslySkipPermissions,
    effort,
    cwd,
    provider = "claude-code",
    ...inferenceOptions
  } = options;
  const modelId = resolveImpelClaudeModelId({
    modelId: explicitModelId,
    defaultModelId,
  });
  const resolvedProviderOptions = createImpelClaudeProviderOptions({
    providerOptions,
    permissionMode,
    allowDangerouslySkipPermissions,
    effort,
    cwd,
  });

  if (inferenceOptions.baseUrl ?? process.env.IMPEL_INFERENCE_URL) {
    return impelInference(modelId, {
      ...inferenceOptions,
      provider,
      providerOptions: resolvedProviderOptions as unknown as Record<
        string,
        unknown
      >,
    });
  }

  return claudeCode(
    localModel ?? inferClaudeCodeLocalModel(modelId, defaultLocalModel),
    resolvedProviderOptions,
  );
}
