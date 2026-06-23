# Retrieval

A library of **swappable retrieval strategies** behind one interface, so they
can be run side-by-side and scored against each other (the eval cockpit reads
the same results). Storage and embedding are interfaces too — in-memory +
persisted index artifacts today; a vector DB only if scale ever demands it.

## Shape

- `types.ts` — the contracts: `RetrievalStrategy`, `VectorStore`, `Embedder`,
  and the doc/result shapes.
- `embedder.ts` — `gatewayEmbedder()` (batched `embedMany` via the Vercel AI
  Gateway). **Embedding contract: `text-embedding-3-large` @ 1536 dims.**
  Ingestion must embed with the identical model + dimensions or the vectors
  aren't comparable.
- `vector-store.ts` — `InMemoryVectorStore` (cosine).
- `index-store.ts` — persist / load a built index as an artifact, so retrieval
  doesn't re-embed every run (mirrors how the platform shipped page embeddings
  in the release manifest).
- `release-index.ts` — **the read end of the pipeline seam.** Loads the index
  _ingestion_ emits at `wiki/_meta/index.json`, **backfills any docs missing an
  embedding** (embedding is best-effort at release), and returns a queryable
  store + the index-pinned embedder to query with. The query MUST use that same
  embedder or the vectors aren't comparable.
- `lexical.ts` — weighted keyword scorer (title/tag/content/path), modeled on
  the platform's ranked wiki search; the lexical half of the hybrid strategies.
- `evidence-gate.ts` — answer-or-abstain decision, modeled on the platform's
  evidence gate.
- `index-builder.ts` — `embedDocs()` / `buildIndex()`: embed pages once, load a
  store.
- `eval.ts` — `compareStrategies()`: run a labeled query set through each
  strategy over one shared store and report hit@1 / hit@5 / MRR, plus the
  out-of-corpus **abstain rate** (queries with no expected page that should trip
  the evidence gate).
- `helpers.ts` — shared scope / snippet / confidence / RRF helpers.
- `load-wiki.ts` — read a wiki directory into `WikiDoc[]`; derives section
  (folder), links (`[[wikilinks]]`), and `pinned` (frontmatter) until ingestion
  emits the real graph.
- `strategies/` — one strategy per file: `flat-embed` (cosine baseline),
  `hybrid-rrf` (lexical + semantic, RRF-fused), and `section-aware` (hybrid +
  backlink expansion + pinned boost + per-section diversification).
- `cli.ts` / `eval-cli.ts` / `build-index-cli.ts` / `query-cli.ts` — dev
  harnesses (not part of the app build). `query-cli.ts` answers over the
  ingestion-emitted index = the end-to-end proof.

## Try it

```bash
# offline unit tests (deterministic fake embedder, no network)
npx tsx --test src/lib/retrieval/*.test.ts

# live run against a wiki directory (needs gateway/OpenAI creds)
npx tsx src/lib/retrieval/cli.ts ./path/to/wiki "how does bond interest work" section-aware

# compare strategies over the emitted index + a labeled query set — let the numbers pick the winner
npx tsx src/lib/retrieval/eval-cli.ts ./wiki/_meta/index.json ./queries.json

# build a saved index artifact (so it doesn't re-embed every run)
npx tsx src/lib/retrieval/build-index-cli.ts ./path/to/wiki ./index.json

# answer over the index INGESTION emitted (wiki/_meta/index.json) — end-to-end
npx tsx src/lib/retrieval/query-cli.ts ./wiki/_meta/index.json "how does bond interest work" section-aware
```

## Roadmap

1. **flat-embed** — query→cosine baseline. _(done)_
2. **hybrid-rrf** — lexical + semantic, RRF-fused, with the evidence gate.
   _(done)_
3. **persisted index artifact** — build once, load without re-embedding.
   _(done)_
4. **section-aware** — hybrid + backlink expansion + pinned boost + per-section
   diversification; sections inform ranking, never a hard filter. _(done)_
5. **consume the emitted index** — load `wiki/_meta/index.json` from ingestion,
   backfill missing embeddings, query it. Closes the ingest→retrieve loop
   end-to-end (`release-index.ts`, `query-cli.ts`). _(done)_
6. **hard section-selection** — _deferred._ A scale optimization that risks
   silently missing the right page; only worth it once wikis are large **and**
   ingestion emits the real section graph. Slots in behind the same interface.
