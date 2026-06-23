import type { RetrievalResult } from "./types.js";

// Whether to answer or abstain, as a decision object the caller branches on —
// modeled on the platform's evidence gate. The retrieval-side analog: abstain when
// there's nothing solid to ground an answer in, so the bot says "that isn't in the
// wiki" instead of confidently making something up.
export type EvidenceGateDecision =
  | { gated: false }
  | { gated: true; reason: "no_results" | "low_confidence" };

export const DEFAULT_CONFIDENCE_FLOOR = 0.35;

export function evidenceGate(
  result: RetrievalResult,
  opts?: { floor?: number }
): EvidenceGateDecision {
  if (result.chunks.length === 0) {
    return { gated: true, reason: "no_results" };
  }
  if (result.confidence < (opts?.floor ?? DEFAULT_CONFIDENCE_FLOOR)) {
    return { gated: true, reason: "low_confidence" };
  }
  return { gated: false };
}
