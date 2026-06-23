// Dev harness for retrieval. Loads a wiki directory, builds an index with the
// gateway embedder, runs one strategy against a query, and prints the ranked hits
// plus the confidence the evidence gate would see. Not part of the app build.
//
//   npx tsx src/lib/retrieval/cli.ts <wikiDir> "<query>" [strategy]
//
// Needs the AI Gateway / OpenAI credentials in the environment to embed.
import { buildIndex } from "./index-builder.js";
import { gatewayEmbedder } from "./embedder.js";
import { InMemoryVectorStore } from "./vector-store.js";
import { buildStrategy, strategyNames, type StrategyName } from "./strategies/index.js";
import { loadWikiDir } from "./load-wiki.js";

async function main() {
  const [dir, query, requested] = process.argv.slice(2);
  if (!dir || !query) {
    console.error(
      `usage: npx tsx src/lib/retrieval/cli.ts <wikiDir> "<query>" [${strategyNames.join("|")}]`
    );
    process.exit(1);
  }
  const name = (requested ?? "flat-embed") as StrategyName;
  if (!strategyNames.includes(name)) {
    console.error(`unknown strategy: ${name}`);
    process.exit(1);
  }

  const embedder = gatewayEmbedder();
  const docs = await loadWikiDir(dir, "cli");
  const store = await buildIndex({
    docs,
    embedder,
    store: new InMemoryVectorStore(),
  });
  console.log(`indexed ${store.size()} pages from ${dir}`);

  const result = await buildStrategy(name, { embedder, store, docs }).retrieve({
    query,
  });
  console.log(
    `\nstrategy=${result.strategy}  confidence=${result.confidence.toFixed(3)}\n`
  );
  for (const chunk of result.chunks) {
    console.log(`${chunk.score.toFixed(3)}  ${chunk.path}`);
    console.log(`        ${chunk.snippet}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
