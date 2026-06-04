import { sha256 as nobleSha256 } from "@noble/hashes/sha256";

/** SHA-256 → Buffer. Accepts string (utf-8) or bytes. */
export function sha256(data: string | Uint8Array): Buffer {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return Buffer.from(nobleSha256(bytes));
}

export const toHex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
export const fromHex = (h: string): Buffer => Buffer.from(h, "hex");

/** Big-endian int64 of a millisecond timestamp — stable across machines. */
export function int64be(ms: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(ms));
  return buf;
}
