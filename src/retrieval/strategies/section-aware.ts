import {
  clamp01,
  confidenceFrom,
  inScope,
  reciprocalRankFusion,
  snippet,
} from "../helpers.js";
import { LexicalIndex } from "../lexical.js";
import type {
  Embedder,
  RetrievalQuery,
  RetrievalResult,
  RetrievalStrategy,
  ScoredChunk,
  VectorStore,
  WikiDoc,
} from "../types.js";

const BACKLINK_SEEDS = 5; // top hits whose linked pages we pull in
const BACKLINK_DECAY = 0.5; // a linked page scores half of its source hit
const PINNED_BOOST = 1.15; // user-curated partitions nudged up
const PER_SECTION_CAP = 3; // diversify so one section can't dominate

type RankedItem = { path: string; score: number; section?: string };

// Resolve a [[wikilink]] target to a doc path — targets are titles or paths.
function buildLinkResolver(
  docs: WikiDoc[]
): (target: string) => string | undefined {
  const byKey = new Map<string, string>();
  for (const doc of docs) {
    byKey.set(doc.path.toLowerCase(), doc.path);
    byKey.set(doc.path.toLowerCase().replace(/\.md$/, ""), doc.path);
    byKey.set(doc.title.toLowerCase(), doc.path);
  }
  return (target) =>
    byKey.get(target.toLowerCase()) ?? byKey.get(`${target.toLowerCase()}.md`);
}

// Take top-k but cap how many come from any one section, so a query that spans
// sections gets spread instead of one section dominating. Backfills from the
// remainder so we still return up to k.
function diversify(ranked: RankedItem[], k: number): RankedItem[] {
  const picked: RankedItem[] = [];
  const overflow: RankedItem[] = [];
  const perSection = new Map<string, number>();
  for (const item of ranked) {
    if (picked.length >= k) break;
    const key = item.section ?? "";
    const count = perSection.get(key) ?? 0;
    if (count < PER_SECTION_CAP) {
      picked.push(item);
      perSection.set(key, count + 1);
    } else {
      overflow.push(item);
    }
  }
  for (const item of overflow) {
    if (picked.length >= k) break;
    picked.push(item);
  }
  return picked;
}

// Section-aware hybrid: the hybrid core, then the structure signals that flat search
// can't use — pull in the pages top hits link to (backlink expansion, the real win
// on a densely-linked wiki), nudge user-pinned partitions, and cap per-section so
// cross-section queries get spread. Sections inform ranking, never a hard filter:
// hard section-selection would risk silently missing the right page.
export class SectionAwareStrategy implements RetrievalStrategy {
  readonly name = "section-aware";
  private lexical: LexicalIndex;
  private docs: Map<string, WikiDoc>;
  private resolveLink: (target: string) => string | undefined;

  constructor(
    private deps: { embedder: Embedder; store: VectorStore; docs: WikiDoc[] }
  ) {
    this.lexical = new LexicalIndex(deps.docs);
    this.docs = new Map(deps.docs.map((doc) => [doc.path, doc]));
    this.resolveLink = buildLinkResolver(deps.docs);
  }

  async retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
    const k = query.k ?? 8;
    const pool = Math.max(k * 4, 20);
    const [embedding] = await this.deps.embedder([query.query]);
    const [semantic, lexical] = await Promise.all([
      this.deps.store.query({ embedding, k: pool, scope: query.scope }),
      Promise.resolve(this.lexical.search(query.query, pool, query.scope)),
    ]);

    // Fused base scores, kept in rank order (Map preserves insertion order).
    const scores = new Map<string, number>();
    for (const { path, score } of reciprocalRankFusion([
      semantic.map((hit) => hit.path),
      lexical.map((hit) => hit.path),
    ])) {
      scores.set(path, score);
    }

    // Backlink expansion: a strong hit's linked pages are often the real answer.
    for (const [path, score] of [...scores.entries()].slice(
      0,
      BACKLINK_SEEDS
    )) {
      for (const target of this.docs.get(path)?.links ?? []) {
        const linkedPath = this.resolveLink(target);
        if (!linkedPath || linkedPath === path) continue;
        const linkedDoc = this.docs.get(linkedPath);
        if (!linkedDoc || !inScope(linkedDoc, query.scope)) continue;
        scores.set(
          linkedPath,
          Math.max(scores.get(linkedPath) ?? 0, score * BACKLINK_DECAY)
        );
      }
    }

    // Soft pinned boost, then rank.
    const ranked: RankedItem[] = [...scores.entries()]
      .map(([path, score]) => {
        const doc = this.docs.get(path);
        return {
          path,
          score: clamp01(doc?.pinned ? score * PINNED_BOOST : score),
          section: doc?.section,
        };
      })
      .sort((a, b) => b.score - a.score);

    const chunks: ScoredChunk[] = [];
    for (const { path, score } of diversify(ranked, k)) {
      const doc = this.docs.get(path);
      if (!doc) continue;
      chunks.push({
        path: doc.path,
        title: doc.title,
        score,
        snippet: snippet(doc.content),
        vault: doc.vault,
        section: doc.section,
      });
    }

    return {
      chunks,
      confidence: confidenceFrom(chunks),
      strategy: this.name,
    };
  }
}
