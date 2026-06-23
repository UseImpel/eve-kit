import { cosineSimilarity } from "ai";
import { clamp01, inScope, snippet } from "./helpers.js";
// In-memory cosine store — the offline eval fixture and the default for the
// harness. The persistent pgvector store will implement this same VectorStore
// interface, so strategies don't change when storage does.
export class InMemoryVectorStore {
    docs = new Map();
    async upsert(docs) {
        for (const doc of docs) {
            this.docs.set(doc.path, doc);
        }
    }
    async query(args) {
        const scored = [];
        for (const doc of this.docs.values()) {
            if (!inScope(doc, args.scope))
                continue;
            scored.push({
                path: doc.path,
                title: doc.title,
                score: clamp01(cosineSimilarity(args.embedding, doc.embedding)),
                snippet: snippet(doc.content),
                vault: doc.vault,
                section: doc.section,
            });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, args.k);
    }
    size() {
        return this.docs.size;
    }
}
//# sourceMappingURL=vector-store.js.map