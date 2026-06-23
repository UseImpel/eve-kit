// What gets embedded for a page. Title + content matches how the page reads, and
// gives the title extra weight in the vector. Page-level for now; chunk-level and
// section embeddings arrive with the hierarchical strategy.
export function embeddingInput(doc) {
    return `${doc.title}\n\n${doc.content}`;
}
// Embed every doc once (batched by the embedder). Split out so the embedded docs
// can be both loaded into a store and persisted as an index artifact.
export async function embedDocs(docs, embedder) {
    const vectors = await embedder(docs.map(embeddingInput));
    return docs.map((doc, i) => ({ ...doc, embedding: vectors[i] }));
}
// Embed the docs and load them into a store. Build is the expensive step; keep it
// separate from query so the same index serves many queries (and so re-embedding
// only runs when the wiki changes).
export async function buildIndex(args) {
    await args.store.upsert(await embedDocs(args.docs, args.embedder));
    return args.store;
}
//# sourceMappingURL=index-builder.js.map