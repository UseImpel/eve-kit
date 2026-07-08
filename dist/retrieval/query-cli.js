// Answer a query over the manifest INGESTION emitted
// (wiki/_meta/index/manifest.json) — the read end of the pipeline. Loads the
// released manifest + sidecars, backfills any missing passage vectors via the
// gateway, runs one strategy, and prints the ranked hits plus the confidence the
// evidence gate would see. This is the end-to-end proof: point it at a real
// release output and the loop (ingest → synthesize → release → RETRIEVE) is
// closed. Not part of the app build.
//
//   npx tsx src/lib/retrieval/query-cli.ts <manifest.json> "<query>" [strategy]
//
// Needs the AI Gateway / OpenAI credentials only if pages are missing sidecars
// (best-effort gateway gaps at release) — a fully-embedded release queries
// offline except for embedding the query itself.
import { loadReleaseIndex } from "./release-index.js";
import { buildStrategy, strategyNames } from "./strategies/index.js";
async function main() {
    const [indexPath, query, requested] = process.argv.slice(2);
    if (!indexPath || !query) {
        console.error(`usage: npx tsx src/lib/retrieval/query-cli.ts <manifest.json> "<query>" [${strategyNames.join("|")}]`);
        process.exit(1);
    }
    const name = (requested ?? "section-aware");
    if (!strategyNames.includes(name)) {
        console.error(`unknown strategy: ${name}`);
        process.exit(1);
    }
    const { store, docs, embedder, stats } = await loadReleaseIndex({
        path: indexPath,
    });
    console.log(`loaded ${stats.total} pages from ${indexPath} ` +
        `(${stats.carried} embedded, ${stats.backfilled} backfilled)`);
    const result = await buildStrategy(name, { embedder, store, docs }).retrieve({
        query,
    });
    console.log(`\nstrategy=${result.strategy}  confidence=${result.confidence.toFixed(3)}\n`);
    for (const chunk of result.chunks) {
        console.log(`${chunk.score.toFixed(3)}  ${chunk.path}`);
        console.log(`        ${chunk.snippet}`);
    }
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=query-cli.js.map