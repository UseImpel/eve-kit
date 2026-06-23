import { buildStrategy, type StrategyName } from "./strategies/index.js";
import { evidenceGate } from "./evidence-gate.js";
import type { Embedder, RetrievalScope, VectorStore, WikiDoc } from "./types.js";

// A query paired with the page it should retrieve — the unit of a retrieval eval.
// Omit `expectedPath` to mark a query OUT OF CORPUS: there's no right page, so the
// strategy should ABSTAIN (the evidence gate fires) rather than surface a wrong one.
export type LabeledQuery = {
  query: string;
  expectedPath?: string;
  scope?: RetrievalScope;
};

export type StrategyReport = {
  strategy: StrategyName;
  n: number; // in-corpus queries scored for ranking
  hitAt1: number; // share of in-corpus queries whose top hit is the expected page
  hitAt5: number; // share whose expected page is in the top 5
  mrr: number; // mean reciprocal rank of the expected page
  outOfCorpus: number; // out-of-corpus queries (no expected page)
  abstainRate: number; // share of those the evidence gate correctly abstains on (1 = ideal)
};

// Run a labeled query set through each strategy over ONE shared, already-built store
// and report hit@1, hit@5, MRR, and the out-of-corpus abstain rate. This is the
// side-by-side comparison the swappable library exists for — pick a strategy by the
// numbers, not by feel. The store is passed in (built once, shared) so the only
// variable across rows is the strategy: in production that store is the REAL emitted
// release index (eval-cli + loadReleaseIndex), so the numbers reflect what retrieval
// actually serves; in tests it's a built fake.
export async function compareStrategies(args: {
  store: VectorStore;
  docs: WikiDoc[];
  embedder: Embedder;
  queries: LabeledQuery[];
  strategies: StrategyName[];
  k?: number;
  floor?: number; // evidence-gate confidence floor for the abstain metric
}): Promise<StrategyReport[]> {
  const k = args.k ?? 5;
  const inCorpus = args.queries.filter((q) => q.expectedPath);
  const outOfCorpus = args.queries.filter((q) => !q.expectedPath);
  const n = inCorpus.length;
  const m = outOfCorpus.length;

  const reports: StrategyReport[] = [];
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
      const rank = result.chunks.findIndex(
        (chunk) => chunk.path === labeled.expectedPath
      );
      if (rank === 0) hit1 += 1;
      if (rank >= 0 && rank < 5) hit5 += 1;
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
      if (evidenceGate(result, { floor: args.floor }).gated) abstained += 1;
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
