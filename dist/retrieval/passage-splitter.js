// Passage-level retrieval: split pages into chunks for better matching.
// The same splitter is used by both retrieval (reading) and ingestion (writing)
// to ensure passages are consistent across the two systems.
// Split page content into passages. Uses a simple heuristic:
// break on paragraphs (double newline), with a soft max per passage.
// If a paragraph exceeds maxPassageLength, it's kept intact
// (we don't split within a paragraph).
//
// This is deterministic so the same content always splits the same way.
export function splitPassages(content, maxPassageLength = 500) {
    if (!content.trim())
        return [];
    // Normalize whitespace and split on paragraph boundaries (double newline)
    const paragraphs = content
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
    if (paragraphs.length === 0)
        return [];
    // Combine small paragraphs until we hit maxPassageLength
    const passages = [];
    let current = "";
    for (const para of paragraphs) {
        const candidate = current ? `${current}\n\n${para}` : para;
        if (candidate.length <= maxPassageLength) {
            current = candidate;
        }
        else {
            if (current)
                passages.push(current);
            current = para;
        }
    }
    if (current)
        passages.push(current);
    return passages;
}
//# sourceMappingURL=passage-splitter.js.map