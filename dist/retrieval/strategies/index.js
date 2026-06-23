import { FlatEmbedStrategy } from "./flat-embed.js";
import { HybridRrfStrategy } from "./hybrid-rrf.js";
import { SectionAwareStrategy } from "./section-aware.js";
export { FlatEmbedStrategy, HybridRrfStrategy, SectionAwareStrategy };
// Registry so the harness and evals can build any strategy by name and run them
// side-by-side. Hard section-selection would register here too, once wikis are
// large enough and the real section graph exists to make it worth the recall risk.
export const strategyNames = [
    "flat-embed",
    "hybrid-rrf",
    "section-aware",
];
export function buildStrategy(name, deps) {
    switch (name) {
        case "flat-embed":
            return new FlatEmbedStrategy(deps);
        case "hybrid-rrf":
            if (!deps.docs)
                throw new Error("hybrid-rrf requires docs");
            return new HybridRrfStrategy({
                embedder: deps.embedder,
                store: deps.store,
                docs: deps.docs,
            });
        case "section-aware":
            if (!deps.docs)
                throw new Error("section-aware requires docs");
            return new SectionAwareStrategy({
                embedder: deps.embedder,
                store: deps.store,
                docs: deps.docs,
            });
    }
}
//# sourceMappingURL=index.js.map