export function clamp01(n) {
    return Math.max(0, Math.min(1, n));
}
export function inScope(doc, scope) {
    if (!scope)
        return true;
    if (scope.vault && doc.vault !== scope.vault)
        return false;
    if (scope.sections && scope.sections.length > 0) {
        return doc.section !== undefined && scope.sections.includes(doc.section);
    }
    return true;
}
export function snippet(content) {
    const flat = content.replace(/\s+/g, " ").trim();
    return flat.length > 200 ? `${flat.slice(0, 200)}…` : flat;
}
// Confidence = top score, tempered by how far it separates from the runner-up. A
// strong, clearly-separated top hit reads as high confidence; a flat tie reads as
// low. The evidence gate keys on this to decide whether to abstain. Shared so
// every strategy reports confidence the same way.
export function confidenceFrom(chunks) {
    const top = chunks[0]?.score ?? 0;
    const second = chunks[1]?.score ?? 0;
    const separation = Math.max(0, top - second);
    return clamp01(0.7 * top + 0.3 * Math.min(1, separation * 2));
}
// Reciprocal-rank-fusion damping. The standard constant; larger flattens the rank
// advantage, smaller sharpens it.
const RRF_K = 60;
// Fuse ranked lists of paths by reciprocal rank fusion: each list votes
// 1/(RRF_K + rank) per item, votes sum. RRF needs only the ordering, so a lexical
// score and a cosine score combine without sharing a scale. Returns paths scored
// 0..1, highest first. Shared by the hybrid and section-aware strategies.
export function reciprocalRankFusion(lists) {
    const totals = new Map();
    for (const list of lists) {
        list.forEach((path, rank) => {
            totals.set(path, (totals.get(path) ?? 0) + 1 / (RRF_K + rank + 1));
        });
    }
    const max = Math.max(...totals.values(), 1);
    return [...totals.entries()]
        .map(([path, score]) => ({ path, score: clamp01(score / max) }))
        .sort((a, b) => b.score - a.score);
}
//# sourceMappingURL=helpers.js.map