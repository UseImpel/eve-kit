import { join } from "node:path";
import { evidenceGate } from "./evidence-gate.js";
import { loadReleaseIndex, RELEASE_INDEX_V2_PATH } from "./release-index.js";
import { buildStrategy } from "./strategies/index.js";
import type { EvidenceGateDecision } from "./evidence-gate.js";
import type { StrategyName } from "./strategies/index.js";
import type {
  Embedder,
  RetrievalResult,
  RetrievalScope,
  RetrievalStrategy,
  VectorStore,
  WikiDoc,
} from "./types.js";

// Agent-facing facade over the retrieval read path. The library exposes the parts
// (loaders, swappable strategies, the evidence gate) on purpose so they can be
// scored head-to-head; an agent that just wants an answer shouldn't have to wire
// them. Retrieval is that wiring in one object: pick a strategy once, then call
// query(). It owns no retrieval logic — every method composes existing pieces.

// section-aware is the strongest strategy (hybrid core + backlink expansion +
// per-section diversification), so it's the default an agent gets unasked.
const DEFAULT_STRATEGY: StrategyName = "section-aware";

export type RetrievalOptions = {
  store: VectorStore;
  embedder: Embedder;
  // Full corpus — required by the strategies with a lexical/graph side
  // (section-aware, hybrid-rrf); flat-embed ignores it. fromReleaseIndex supplies
  // it for you.
  docs?: WikiDoc[];
  strategy?: StrategyName; // default: section-aware
  floor?: number; // evidence-gate confidence floor; default: DEFAULT_CONFIDENCE_FLOOR
};

// What query() returns: the strategy's own result plus the gate's answer/abstain
// decision, so the agent branches on `gate.gated` and never has to call the gate
// itself. Reuses the library's RetrievalResult and EvidenceGateDecision verbatim.
export type RetrievalAnswer = RetrievalResult & {
  gate: EvidenceGateDecision;
};

export type FromReleaseIndexOptions = {
  // Path to the emitted v2 manifest. Give `path` to point at it directly, or
  // `vault` to resolve it at the conventional location
  // (wiki/_meta/index/manifest.json) inside a vault dir. Defaults to
  // RELEASE_INDEX_V2_PATH (cwd-relative).
  path?: string;
  vault?: string;
  // Leave unset in production so the embedder follows the index's own space (see
  // loadReleaseIndex); pass one only for tests/offline.
  embedder?: Embedder;
  strategy?: StrategyName;
  floor?: number;
};

function resolveIndexPath(opts: FromReleaseIndexOptions): string {
  if (opts.path) return opts.path;
  if (opts.vault) return join(opts.vault, RELEASE_INDEX_V2_PATH);
  return RELEASE_INDEX_V2_PATH;
}

export class Retrieval {
  readonly strategy: RetrievalStrategy;
  private readonly floor?: number;

  constructor(opts: RetrievalOptions) {
    this.strategy = buildStrategy(opts.strategy ?? DEFAULT_STRATEGY, {
      embedder: opts.embedder,
      store: opts.store,
      docs: opts.docs,
    });
    this.floor = opts.floor;
  }

  // Load the manifest + sidecars INGESTION emitted at release and return a
  // ready-to-query instance. Uses the release-index loader, which backfills any
  // missing passage vectors in the manifest's own space; the same
  // manifest-pinned embedder is then used to embed queries, so query and
  // document vectors are comparable. Throws when the manifest is missing —
  // there is no fallback to the frozen index.json.
  static async fromReleaseIndex(
    opts: FromReleaseIndexOptions = {}
  ): Promise<Retrieval> {
    const { store, docs, embedder } = await loadReleaseIndex({
      path: resolveIndexPath(opts),
      embedder: opts.embedder,
    });
    return new Retrieval({
      store,
      embedder,
      docs,
      strategy: opts.strategy,
      floor: opts.floor,
    });
  }

  // Run the chosen strategy and apply the evidence gate. The gate decision rides
  // alongside the ranked hits so the caller answers or abstains without re-deriving
  // it. `floor` overrides the instance default for this one query.
  async query(
    query: string,
    opts?: { k?: number; scope?: RetrievalScope; floor?: number }
  ): Promise<RetrievalAnswer> {
    const result = await this.strategy.retrieve({
      query,
      k: opts?.k,
      scope: opts?.scope,
    });
    const gate = evidenceGate(result, { floor: opts?.floor ?? this.floor });
    return { ...result, gate };
  }
}
