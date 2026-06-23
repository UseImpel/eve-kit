// Side-by-side strategy comparison over the index INGESTION emitted
// (wiki/_meta/index.json) — evals the REAL released vectors, not a fresh build, so
// the numbers reflect what retrieval actually serves. Loads the index (backfilling
// any docs that shipped without an embedding), then scores every strategy over it.
// Not part of the app build.
//
//   npx tsx src/lib/retrieval/eval-cli.ts <index.json> <queries.json>
//
// queries.json: [{ "query": "...", "expectedPath": "finance/bonds.md" }, ...]
//   omit expectedPath to mark a query out-of-corpus (it should abstain).
// Needs the AI Gateway / OpenAI credentials to embed the queries (and any docs the
// index shipped without a vector).
import { readFile } from "node:fs/promises";
import { loadReleaseIndex } from "./release-index.js";
import { compareStrategies, type LabeledQuery } from "./eval.js";
import { strategyNames } from "./strategies/index.js";

async function main() {
  const [indexPath, queriesPath] = process.argv.slice(2);
  if (!indexPath || !queriesPath) {
    console.error(
      "usage: npx tsx src/lib/retrieval/eval-cli.ts <index.json> <queries.json>"
    );
    process.exit(1);
  }

  const { store, docs, embedder, stats } = await loadReleaseIndex({
    path: indexPath,
  });
  console.log(
    `loaded ${stats.total} pages from ${indexPath} ` +
      `(${stats.carried} embedded, ${stats.backfilled} backfilled)`
  );

  const queries = JSON.parse(
    await readFile(queriesPath, "utf8")
  ) as LabeledQuery[];

  const reports = await compareStrategies({
    store,
    docs,
    embedder,
    queries,
    strategies: [...strategyNames],
  });

  console.table(
    reports.map((report) => ({
      strategy: report.strategy,
      "hit@1": report.hitAt1.toFixed(3),
      "hit@5": report.hitAt5.toFixed(3),
      mrr: report.mrr.toFixed(3),
      n: report.n,
      "abstain@ooc":
        report.outOfCorpus === 0 ? "—" : report.abstainRate.toFixed(3),
      ooc: report.outOfCorpus,
    }))
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
