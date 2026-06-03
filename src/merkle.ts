import { createHash } from "node:crypto";

/**
 * Append-only binary Merkle tree over leaf hashes (hex strings).
 *
 * Domain separation prevents second-preimage attacks: leaves are already
 * hashed by the caller with a 0x00 prefix (see leafHash), and internal nodes
 * are hashed here with a 0x01 prefix. An odd node at any level is promoted
 * (hashed with itself) — a standard, unambiguous construction.
 */

const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Hash a leaf payload (hex) with leaf domain separation. */
export function leafHash(payloadHex: string): string {
  return sha256(Buffer.concat([LEAF_PREFIX, Buffer.from(payloadHex, "hex")]));
}

function hashPair(left: string, right: string): string {
  return sha256(Buffer.concat([NODE_PREFIX, Buffer.from(left, "hex"), Buffer.from(right, "hex")]));
}

/** Root of an empty tree. */
export const EMPTY_ROOT = createHash("sha256").update(Buffer.alloc(0)).digest("hex");

/** Compute the Merkle root over an ordered list of leaf hashes. */
export function computeRoot(leaves: string[]): string {
  if (leaves.length === 0) return EMPTY_ROOT;
  let level = leaves.slice();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const l = level[i]!;
      const r = i + 1 < level.length ? level[i + 1]! : l; // promote odd node
      next.push(hashPair(l, r));
    }
    level = next;
  }
  return level[0]!;
}

export interface ProofStep {
  hash: string;
  dir: "L" | "R"; // side the sibling sits on
}

/** Inclusion proof for the leaf at `index`. */
export function computeProof(leaves: string[], index: number): ProofStep[] {
  if (index < 0 || index >= leaves.length) throw new Error(`index ${index} out of range`);
  const proof: ProofStep[] = [];
  let level = leaves.slice();
  let idx = index;
  while (level.length > 1) {
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    const sibling = siblingIdx < level.length ? level[siblingIdx]! : level[idx]!; // odd → self
    proof.push({ hash: sibling, dir: isRight ? "L" : "R" });
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const l = level[i]!;
      const r = i + 1 < level.length ? level[i + 1]! : l;
      next.push(hashPair(l, r));
    }
    level = next;
    idx = Math.floor(idx / 2);
  }
  return proof;
}

/** Recompute the root from a leaf + proof and compare to the expected root. */
export function verifyProof(leaf: string, proof: ProofStep[], root: string): boolean {
  let acc = leaf;
  for (const step of proof) {
    acc = step.dir === "L" ? hashPair(step.hash, acc) : hashPair(acc, step.hash);
  }
  return acc === root;
}
