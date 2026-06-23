import { buildStrategy } from "./strategies/index.js";
import { evidenceGate } from "./evidence-gate.js";
// Run a labeled query set through each strategy over ONE shared, already-built store
// and report hit@1, hit@5, MRR, and the out-of-corpus abstain rate. This is the
// side-by-side comparison the swappable library exists for — pick a strategy by the
// numbers, not by feel. The store is passed in (built once, shared) so the only
// variable across rows is the strategy: in production that store is the REAL emitted
// release index (eval-cli + loadReleaseIndex), so the numbers reflect what retrieval
// actually serves; in tests it's a built fake.
export async function compareStrategies(args) {
    const k = args.k ?? 5;
    const inCorpus = args.queries.filter((q) => q.expectedPath);
    const outOfCorpus = args.queries.filter((q) => !q.expectedPath);
    const n = inCorpus.length;
    const m = outOfCorpus.length;
    const reports = [];
    for (const name of args.strategies) {
        const strategy = buildStrategy(name, {
            embedder: args.embedder,
            store: args.store,
            docs: args.docs,
        });
        let hit1 = 0;
        let hit5 = 0;
        let reciprocalRankSum = 0;
        for (const labeled of inCorpus) {
            const result = await strategy.retrieve({
                query: labeled.query,
                scope: labeled.scope,
                k,
            });
            const rank = result.chunks.findIndex((chunk) => chunk.path === labeled.expectedPath);
            if (rank === 0)
                hit1 += 1;
            if (rank >= 0 && rank < 5)
                hit5 += 1;
            reciprocalRankSum += rank >= 0 ? 1 / (rank + 1) : 0;
        }
        // Out-of-corpus: there's no right page, so the win is abstaining. Score the
        // evidence gate the live answer path would consult, not the rankings.
        let abstained = 0;
        for (const labeled of outOfCorpus) {
            const result = await strategy.retrieve({
                query: labeled.query,
                scope: labeled.scope,
                k,
            });
            if (evidenceGate(result, { floor: args.floor }).gated)
                abstained += 1;
        }
        reports.push({
            strategy: name,
            n,
            hitAt1: n === 0 ? 0 : hit1 / n,
            hitAt5: n === 0 ? 0 : hit5 / n,
            mrr: n === 0 ? 0 : reciprocalRankSum / n,
            outOfCorpus: m,
            abstainRate: m === 0 ? 0 : abstained / m,
        });
    }
    return reports;
}
//# sourceMappingURL=eval.js.map