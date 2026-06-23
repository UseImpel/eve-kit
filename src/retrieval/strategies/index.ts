import type {
  Embedder,
  RetrievalStrategy,
  VectorStore,
  WikiDoc,
} from "../types.js";
import { FlatEmbedStrategy } from "./flat-embed.js";
import { HybridRrfStrategy } from "./hybrid-rrf.js";
import { SectionAwareStrategy } from "./section-aware.js";

export { FlatEmbedStrategy, HybridRrfStrategy, SectionAwareStrategy };

// Dependencies a strategy can draw on. `docs` is the full corpus, needed by
// strategies with a lexical/graph side (hybrid-rrf, section-aware); pure-vector
// strategies ignore it.
export type StrategyDeps = {
  embedder: Embedder;
  store: VectorStore;
  docs?: WikiDoc[];
};

// Registry so the harness and evals can build any strategy by name and run them
// side-by-side. Hard section-selection would register here too, once wikis are
// large enough and the real section graph exists to make it worth the recall risk.
export const strategyNames = [
  "flat-embed",
  "hybrid-rrf",
  "section-aware",
] as const;
export type StrategyName = (typeof strategyNames)[number];

export function buildStrategy(
  name: StrategyName,
  deps: StrategyDeps
): RetrievalStrategy {
  switch (name) {
    case "flat-embed":
      return new FlatEmbedStrategy(deps);
    case "hybrid-rrf":
      if (!deps.docs) throw new Error("hybrid-rrf requires docs");
      return new HybridRrfStrategy({
        embedder: deps.embedder,
        store: deps.store,
        docs: deps.docs,
      });
    case "section-aware":
      if (!deps.docs) throw new Error("section-aware requires docs");
      return new SectionAwareStrategy({
        embedder: deps.embedder,
        store: deps.store,
        docs: deps.docs,
      });
  }
}
