export const DEFAULT_CONTEXT_WINDOW_TOKENS = 200000;
export const IMPEL_EVE_DEFAULT_CONTEXT_WINDOW_TOKENS =
  DEFAULT_CONTEXT_WINDOW_TOKENS;

const LEGACY_MODEL_IDS: Record<string, string> = {
  haiku: "anthropic/claude-haiku-4.5",
  opus: "anthropic/claude-opus-4.8",
  sonnet: "anthropic/claude-sonnet-4.6",
  "claude-haiku-4-5": "anthropic/claude-haiku-4.5",
  "claude-opus-4": "anthropic/claude-opus-4",
  "claude-opus-4-1": "anthropic/claude-opus-4.1",
  "claude-opus-4-5": "anthropic/claude-opus-4.5",
  "claude-opus-4-6": "anthropic/claude-opus-4.6",
  "claude-opus-4-7": "anthropic/claude-opus-4.7",
  "claude-opus-4-8": "anthropic/claude-opus-4.8",
  "claude-sonnet-4": "anthropic/claude-sonnet-4",
  "claude-sonnet-4-5": "anthropic/claude-sonnet-4.5",
  "claude-sonnet-4-6": "anthropic/claude-sonnet-4.6",
};

export function toGatewayModelId(modelId: string): string {
  const trimmed = modelId.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes("/")) return trimmed;

  const legacy = LEGACY_MODEL_IDS[trimmed];
  if (legacy) return legacy;

  if (/^(gpt|o[0-9]|codex)/i.test(trimmed)) {
    return `openai/${trimmed}`;
  }

  if (/^claude-/i.test(trimmed)) {
    return `anthropic/${trimmed}`;
  }

  return trimmed;
}

export function resolveGatewayModelId(
  envNames: readonly string[],
  defaultModelId: string,
): string {
  for (const name of envNames) {
    const value = process.env[name]?.trim();
    if (value) return toGatewayModelId(value);
  }
  return defaultModelId;
}

export const toImpelGatewayModelId = toGatewayModelId;
export const resolveImpelGatewayModelId = resolveGatewayModelId;
