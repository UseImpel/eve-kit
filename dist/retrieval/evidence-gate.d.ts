import type { RetrievalResult } from "./types.js";
export type EvidenceGateDecision = {
    gated: false;
} | {
    gated: true;
    reason: "no_results" | "low_confidence";
};
export declare const DEFAULT_CONFIDENCE_FLOOR = 0.35;
export declare function evidenceGate(result: RetrievalResult, opts?: {
    floor?: number;
}): EvidenceGateDecision;
//# sourceMappingURL=evidence-gate.d.ts.map