// Core retrieval contracts. Everything in the retrieval library implements
// RetrievalStrategy, so strategies are swappable behind one interface and scored
// head-to-head in evals — that swappability is the whole point (see
// strategies/index.ts). Storage and embedding are interfaces too, so the
// in-memory store today and pgvector tomorrow are drop-in.
export {};
//# sourceMappingURL=types.js.map