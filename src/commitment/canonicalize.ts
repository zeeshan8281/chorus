import { sha256 } from "./hasher.js";

/**
 * Deterministic byte representation of memory content. The SAME logical content
 * must always produce the same bytes (and therefore the same hash), regardless
 * of key ordering or insignificant whitespace — otherwise verification breaks.
 */
export function canonicalize(content: string, metadata: Record<string, unknown> = {}): Buffer {
  const canonical = { content: content.trim(), metadata: sortKeysDeep(metadata) };
  return Buffer.from(JSON.stringify(canonical), "utf-8");
}

export function contentHash(content: string, metadata: Record<string, unknown> = {}): Buffer {
  return sha256(canonicalize(content, metadata));
}

function sortKeysDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (obj && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}
