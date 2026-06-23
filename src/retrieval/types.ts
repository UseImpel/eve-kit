// Core retrieval contracts. Everything in the retrieval library implements
// RetrievalStrategy, so strategies are swappable behind one interface and scored
// head-to-head in evals — that swappability is the whole point (see
// strategies/index.ts). Storage and embedding are interfaces too, so the
// in-memory store today and pgvector tomorrow are drop-in.

export type WikiDoc = {
  path: string; // stable id within the vault
  title: string;
  content: string;
  vault?: string; // scope: which wiki/vault this belongs to
  section?: string; // scope: topical section (set once ingestion emits the section graph)
  tags?: string[];
  links?: string[]; // outgoing wikilink targets, for backlink-aware retrieval
  pinned?: boolean; // user-curated partition: kept intact + boosted, never merged away
};

export type EmbeddedDoc = WikiDoc & { embedding: number[] };

export type ScoredChunk = {
  path: string;
  title: string;
  score: number; // 0..1, strategy-normalized
  snippet: string;
  vault?: string;
  section?: string;
};

export type RetrievalScope = {
  vault?: string; // restrict to one vault/wiki
  sections?: string[]; // restrict to specific sections
};

export type RetrievalQuery = {
  query: string;
  scope?: RetrievalScope;
  k?: number; // max results
};

export type RetrievalResult = {
  chunks: ScoredChunk[];
  confidence: number; // 0..1 — drives the evidence gate (abstain when low)
  strategy: string;
};

export interface RetrievalStrategy {
  readonly name: string;
  retrieve(query: RetrievalQuery): Promise<RetrievalResult>;
}

// texts -> one vector per text, order-preserving.
export type Embedder = (texts: string[]) => Promise<number[][]>;

export interface VectorStore {
  upsert(docs: EmbeddedDoc[]): Promise<void>;
  // Nearest neighbours by cosine, optionally scoped to a vault/sections.
  query(args: {
    embedding: number[];
    k: number;
    scope?: RetrievalScope;
  }): Promise<ScoredChunk[]>;
  size(): number;
}
