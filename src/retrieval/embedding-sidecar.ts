// Embedding sidecars — the binary passage-vector files ingestion writes next to
// the v2 manifest. One sidecar per unique contentHash, immutable, at
// wiki/_meta/embeddings/<contentHash>__<modelId>__<dimensions>.bin
// (modelId contains a `/`, e.g. "openai/text-embedding-3-large", so the file
// lands one directory deep — path joins handle that transparently).
//
// Format: 4-byte LE uint32 (manifest JSON length) + UTF-8 JSON + float32 vectors.
// The JSON manifest carries the passage boundaries (charOffset/charLength into the
// page content), so the READER never has to reproduce the writer's splitter —
// slicing by these offsets is what keeps passage texts aligned with their vectors
// across the two repos. Mirror of impel-ingestion's
// agent/lib/stores/embedding-sidecar.ts; the two must agree byte-for-byte.

export type SidecarPassageInfo = {
  index: number;
  charOffset: number;
  charLength: number;
};

export type SidecarManifest = {
  modelId: string;
  dimensions: number;
  passageCount: number;
  passages: SidecarPassageInfo[];
};

export type EmbeddingSidecar = {
  manifest: SidecarManifest;
  vectors: number[][]; // one float32 vector per passage
};

// Relative path of a sidecar under the embeddings dir, matching ingestion's
// sidecarPath() naming exactly.
export function sidecarFileName(
  contentHash: string,
  modelId: string,
  dimensions: number
): string {
  return `${contentHash}__${modelId}__${dimensions}.bin`;
}

// Serialize a sidecar to the binary format. Deterministic: same input, same
// bytes. Exists mainly so tests can emit real sidecars; production sidecars are
// written by ingestion.
export function serializeSidecar(sidecar: EmbeddingSidecar): Buffer {
  const manifestBytes = Buffer.from(JSON.stringify(sidecar.manifest), "utf-8");

  const vectorArray = new Float32Array(
    sidecar.vectors.length * sidecar.manifest.dimensions
  );
  let idx = 0;
  for (const vector of sidecar.vectors) {
    for (const val of vector) vectorArray[idx++] = val;
  }
  const vectorBytes = Buffer.from(vectorArray.buffer);

  const buf = Buffer.alloc(4 + manifestBytes.length + vectorBytes.length);
  buf.writeUInt32LE(manifestBytes.length, 0);
  manifestBytes.copy(buf, 4);
  vectorBytes.copy(buf, 4 + manifestBytes.length);
  return buf;
}

// Deserialize a sidecar buffer. Throws on malformed/truncated input — callers
// treat that as "sidecar unusable" and backfill, they don't fail the load.
export function deserializeSidecar(buffer: Buffer): EmbeddingSidecar {
  if (buffer.length < 4) {
    throw new Error("deserializeSidecar: buffer too short (< 4 bytes)");
  }

  const manifestLength = buffer.readUInt32LE(0);
  if (4 + manifestLength > buffer.length) {
    throw new Error(
      `deserializeSidecar: manifest length ${manifestLength} exceeds buffer (total ${buffer.length})`
    );
  }

  const manifest = JSON.parse(
    buffer.toString("utf-8", 4, 4 + manifestLength)
  ) as SidecarManifest;

  const vectorStartByte = 4 + manifestLength;
  const vectorBytesNeeded = manifest.passageCount * manifest.dimensions * 4;
  if (vectorStartByte + vectorBytesNeeded !== buffer.length) {
    throw new Error(
      `deserializeSidecar: vector data size mismatch (expected ${vectorBytesNeeded}, got ${buffer.length - vectorStartByte})`
    );
  }

  // Read float32s via readFloatLE rather than a Float32Array view: the view
  // constructor requires a 4-aligned byteOffset, and 4 + manifestLength rarely is.
  const vectors: number[][] = [];
  for (let i = 0; i < manifest.passageCount; i++) {
    const vector: number[] = new Array(manifest.dimensions);
    for (let j = 0; j < manifest.dimensions; j++) {
      vector[j] = buffer.readFloatLE(
        vectorStartByte + (i * manifest.dimensions + j) * 4
      );
    }
    vectors.push(vector);
  }

  return { manifest, vectors };
}
