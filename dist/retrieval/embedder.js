import { embedMany } from "ai";
// Shared embedding contract for the whole retrieval library.
//
// Production uses text-embedding-3-large reduced to 1536 dims (OpenAI Matryoshka):
// best gateway-native retrieval quality, and 1536 stays under pgvector's hnsw
// 2000-dim cap. INGESTION MUST embed with the identical model + dimensions, or the
// query and document vectors live in different spaces and can't be compared — this
// is the mechanical reason ingestion routing and retrieval share one index.
export const EMBEDDING_MODEL = "openai/text-embedding-3-large";
export const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_BATCH_SIZE = 96;
const EMBEDDING_INPUT_MAX_CHARS = 8_000;
function batches(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}
// Embeds via the Vercel AI Gateway (embeddings route through Vercel's inference).
// Batched to keep request counts down on large vaults; inputs are length-capped
// because embedding models truncate silently otherwise.
export function gatewayEmbedder(opts) {
    const model = opts?.model ?? EMBEDDING_MODEL;
    const dimensions = opts?.dimensions ?? EMBEDDING_DIMENSIONS;
    return async (texts) => {
        const out = [];
        for (const batch of batches(texts, EMBEDDING_BATCH_SIZE)) {
            const { embeddings } = await embedMany({
                model,
                values: batch.map((t) => t.slice(0, EMBEDDING_INPUT_MAX_CHARS)),
                providerOptions: { openai: { dimensions } },
            });
            out.push(...embeddings);
        }
        return out;
    };
}
//# sourceMappingURL=embedder.js.map