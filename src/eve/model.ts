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
export const IMPEL_CODEX_CONTEXT_WINDOW_TOKENS = 200000;
export const IMPEL_DEFAULT_CODEX_MODEL_ID = "gpt-5.5";

export interface ImpelClaudeProviderOptionsInput {
  providerOptions?: ClaudeCodeSettings;
  localProviderOptions?: ClaudeCodeSettings;
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

export interface ImpelCodexProviderOptionsInput {
  providerOptions?: Record<string, unknown>;
  approvalMode?: string;
  sandboxMode?: string;
  skipGitRepoCheck?: boolean;
  effort?: string;
}

export interface ImpelCodexModelOptions
  extends Omit<ImpelInferenceOptions, "providerOptions" | "provider">,
    ImpelCodexProviderOptionsInput {
  modelId?: string;
  defaultModelId?: string;
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

export function createImpelCodexProviderOptions({
  providerOptions,
  approvalMode = "never",
  sandboxMode = "workspace-write",
  skipGitRepoCheck = true,
  effort,
}: ImpelCodexProviderOptionsInput = {}): Record<string, unknown> {
  return {
    approvalMode,
    sandboxMode,
    skipGitRepoCheck,
    ...(effort ? { effort } : {}),
    ...(providerOptions ?? {}),
  };
}

export function resolveImpelCodexModelId({
  modelId,
  defaultModelId = IMPEL_DEFAULT_CODEX_MODEL_ID,
}: {
  modelId?: string;
  defaultModelId?: string;
} = {}): string {
  return modelId ?? process.env.IMPEL_CODEX_MODEL_ID ?? defaultModelId;
}

export function inferClaudeCodeLocalModel(
  modelId: string,
  fallback: ClaudeCodeModelId = "opus",
): ClaudeCodeModelId {
  if (/sonnet/i.test(modelId)) return "sonnet";
  if (/haiku/i.test(modelId)) return "haiku";
  return fallback;
}

/**
 * Is this a deployed Vercel serverless runtime (as opposed to local dev)?
 *
 * We key off `VERCEL_ENV` rather than `VERCEL` on purpose. Vercel sets
 * `VERCEL_ENV` to exactly "production" | "preview" | "development":
 *   - "production" / "preview" -> a real, remote deployment. There is NO Claude
 *     Code CLI and NO Anthropic OAuth credential here, so the local `claudeCode`
 *     provider can never work — it only throws a cryptic `AI_LoadAPIKeyError`
 *     deep in the tool loop.
 *   - "development" -> `vercel dev` running on a developer's machine, where the
 *     Claude Code CLI IS available, so `claudeCode` is valid.
 *
 * `VERCEL` (==="1") is deliberately NOT used as the signal: it is also set by
 * `vercel dev` and during local builds, where claudeCode is valid. Treating
 * `VERCEL=1` as "deployed" would break local development — the exact thing we
 * must not do. Keying off production/preview only is the conservative choice:
 * the loud failure can only fire on a real remote deploy, never locally.
 */
function isDeployedServerlessRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
  );
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
    localProviderOptions,
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

  // The durable impel-inference proxy was not selected (no baseUrl and no
  // IMPEL_INFERENCE_URL). The only remaining path is the local `claudeCode`
  // provider, which depends on the Claude Code CLI + Anthropic OAuth credentials
  // that exist ONLY in local development. In a deployed serverless runtime those
  // are absent, so claudeCode throws a late, cryptic `AI_LoadAPIKeyError` deep in
  // the tool loop (it surfaces as MODEL_CALL_FAILED / a chat stuck at "Starting
  // runtime") — a missing-env misconfiguration that is painful to diagnose.
  //
  // Fail loud and early instead, but ONLY when we are certain we are in a
  // deployed runtime (see isDeployedServerlessRuntime: production/preview only).
  // Local dev — plain `node`/`tsx`/`eve dev` (no VERCEL_ENV) and `vercel dev`
  // (VERCEL_ENV="development") — still falls through to claudeCode exactly as
  // before. `IMPEL_ALLOW_CLAUDE_CODE_FALLBACK=1` is an explicit escape hatch to
  // force the local provider even on a deploy.
  if (
    isDeployedServerlessRuntime() &&
    process.env.IMPEL_ALLOW_CLAUDE_CODE_FALLBACK !== "1"
  ) {
    throw new Error(
      "IMPEL_INFERENCE_URL is not set — this deployed agent cannot reach " +
        "impel-inference, and the local claude-code provider only works in local " +
        "development (it requires the Claude Code CLI and Anthropic OAuth " +
        "credentials, which do not exist in a Vercel serverless runtime). Set " +
        "IMPEL_INFERENCE_URL (and IMPEL_INFERENCE_API_KEY) on this deployment, or " +
        "set IMPEL_ALLOW_CLAUDE_CODE_FALLBACK=1 to force the local provider.",
    );
  }

  return claudeCode(
    localModel ?? inferClaudeCodeLocalModel(modelId, defaultLocalModel),
    { ...resolvedProviderOptions, ...(localProviderOptions ?? {}) },
  );
}

export function createImpelCodexModel(
  options: ImpelCodexModelOptions = {},
): LanguageModelV3 {
  const {
    modelId: explicitModelId,
    defaultModelId,
    providerOptions,
    approvalMode,
    sandboxMode,
    skipGitRepoCheck,
    effort,
    ...inferenceOptions
  } = options;
  const modelId = resolveImpelCodexModelId({
    modelId: explicitModelId,
    defaultModelId,
  });

  return impelInference(modelId, {
    ...inferenceOptions,
    provider: "codex-cli",
    providerOptions: createImpelCodexProviderOptions({
      providerOptions,
      approvalMode,
      sandboxMode,
      skipGitRepoCheck,
      effort,
    }),
  });
}
