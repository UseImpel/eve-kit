// Build the retrieval index from a wiki directory and write it as an artifact, so
// retrieval can load it without re-embedding. Not part of the app build.
//
//   npx tsx src/lib/retrieval/build-index-cli.ts <wikiDir> <out.json> [vault]
//
// Needs the AI Gateway / OpenAI credentials in the environment to embed.
import { gatewayEmbedder } from "./embedder.js";
import { loadWikiDir } from "./load-wiki.js";
import { embedDocs } from "./index-builder.js";
import { saveIndex, serializeIndex } from "./index-store.js";

async function main() {
  const [dir, out, vault] = process.argv.slice(2);
  if (!dir || !out) {
    console.error(
      "usage: npx tsx src/lib/retrieval/build-index-cli.ts <wikiDir> <out.json> [vault]"
    );
    process.exit(1);
  }
  const docs = await loadWikiDir(dir, vault);
  const embedded = await embedDocs(docs, gatewayEmbedder());
  await saveIndex(out, serializeIndex(embedded));
  console.log(`indexed ${embedded.length} pages -> ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
