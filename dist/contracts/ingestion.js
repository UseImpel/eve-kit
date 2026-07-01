// Canonical ingestion data contract — the RunRecord shape (and its trigger /
// connector / wiki-vault companions) exchanged between `next` (the client,
// src/lib/ingestion/eve-client.ts) and `impel-ingestion` (the server,
// agent/channels/http.ts). Kept in one place so proxy routes, server
// components, client views, and the backend channel all agree on the wire
// shape.
//
// These are plain TS types (no runtime validation) — ported verbatim from the
// hand-duplicated originals. zod schemas are intentionally NOT added here;
// neither side validates these shapes at runtime today.
// The canonical 7-stage pipeline, in order. Drives the DAG node layout and gives
// the detail view a stable skeleton even before any stage has reported.
export const STAGE_ORDER = [
    "intake",
    "standardize",
    "route",
    "size",
    "synthesize",
    "release",
    "pr",
];
export function uxState(status) {
    switch (status) {
        case "running":
            return "IN-FLIGHT";
        case "trial_open":
            return "OPEN";
        case "merged":
            return "MERGED";
        case "rejected":
            return "REJECTED";
        case "failed":
        case "skipped_budget":
        default:
            return "FAILED";
    }
}
//# sourceMappingURL=ingestion.js.map