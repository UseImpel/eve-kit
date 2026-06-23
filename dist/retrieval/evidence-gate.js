export const DEFAULT_CONFIDENCE_FLOOR = 0.35;
export function evidenceGate(result, opts) {
    if (result.chunks.length === 0) {
        return { gated: true, reason: "no_results" };
    }
    if (result.confidence < (opts?.floor ?? DEFAULT_CONFIDENCE_FLOOR)) {
        return { gated: true, reason: "low_confidence" };
    }
    return { gated: false };
}
//# sourceMappingURL=evidence-gate.js.map