import { inScope } from "./helpers.js";
import type { RetrievalScope, WikiDoc } from "./types.js";

// Weighted lexical scoring, modeled on the platform's ranked wiki search: a query
// token in the title counts far more than one in the body. This is the keyword
// half of the hybrid strategy — fused with semantic cosine so the topically-right
// page wins over a merely word-matchy one.
const WEIGHTS = { title: 12, tag: 6, content: 4, path: 3 } as const;

export type LexicalHit = { path: string; score: number };

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((token) => token.length >= 2);
}

function countHits(
  tokens: string[],
  predicate: (token: string) => boolean
): number {
  return tokens.filter(predicate).length;
}

type LexicalEntry = {
  doc: WikiDoc;
  title: string;
  path: string;
  tags: string[];
  content: string;
};

// Prebuilt, lowercased fields so search is a scan, not a re-parse per query. Held
// in memory now; the same shape maps to Postgres full-text search behind the
// VectorStore's sibling once pgvector lands.
export class LexicalIndex {
  private entries: LexicalEntry[];

  constructor(docs: WikiDoc[]) {
    this.entries = docs.map((doc) => ({
      doc,
      title: doc.title.toLowerCase(),
      path: doc.path.toLowerCase(),
      tags: (doc.tags ?? []).map((tag) => tag.toLowerCase()),
      content: doc.content.toLowerCase(),
    }));
  }

  search(query: string, k: number, scope?: RetrievalScope): LexicalHit[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];
    const hits: LexicalHit[] = [];
    for (const entry of this.entries) {
      if (!inScope(entry.doc, scope)) continue;
      const score =
        WEIGHTS.title * countHits(tokens, (t) => entry.title.includes(t)) +
        WEIGHTS.tag *
          countHits(tokens, (t) => entry.tags.some((tag) => tag.includes(t))) +
        WEIGHTS.content * countHits(tokens, (t) => entry.content.includes(t)) +
        WEIGHTS.path * countHits(tokens, (t) => entry.path.includes(t));
      if (score > 0) hits.push({ path: entry.doc.path, score });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, k);
  }
}
