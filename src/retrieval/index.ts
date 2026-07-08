// Public retrieval library API. Strategies are swappable behind one interface
// (see types.ts / strategies/index.ts) and scored head-to-head via eval.ts.
// Dev-only CLIs (cli, build-index-cli, query-cli, eval-cli) are intentionally
// NOT re-exported here.

export * from "./types.js";
export * from "./strategies/index.js";
export * from "./embedder.js";
export * from "./vector-store.js";
export * from "./index-store.js";
export * from "./release-index.js";
export * from "./evidence-gate.js";
export * from "./retrieval.js";
export * from "./index-builder.js";
export * from "./lexical.js";
export * from "./eval.js";
export * from "./helpers.js";
export * from "./load-wiki.js";
export * from "./passage-splitter.js";
export * from "./manifest-loader.js";
export * from "./embedding-sidecar.js";
