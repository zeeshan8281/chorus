import { sha256, int64be } from "../commitment/hasher.js";

/**
 * Append-only Merkle tree over memory commitments.
 *
 *   leaf      = SHA-256( contentHash ‖ memoryId ‖ int64be(timestampMs) )
 *   internal  = SHA-256( left ‖ right )
 *   absent    = SHA-256("EMPTY")   (padding for incomplete levels)
 *
 * Proofs are generated against the current leaf set and recomputed by the
 * client, so generation and verification stay in lock-step. (The leaf set is
 * persisted sparsely as level-0 merkle_nodes; upper levels are recomputed —
 * see PRD §12 open question #1, "recompute for the demo".)
 */

export const EMPTY_HASH = sha256("EMPTY");

export function computeLeafHash(contentHash: Buffer, memoryId: string, timestamp: Date): Buffer {
  return sha256(Buffer.concat([contentHash, Buffer.from(memoryId, "utf-8"), int64be(timestamp.getTime())]));
}

function hashPair(left: Buffer, right: Buffer): Buffer {
  return sha256(Buffer.concat([left, right]));
}

function depthFor(count: number): number {
  return Math.ceil(Math.log2(Math.max(count, 2)));
}

function pad(leaves: Buffer[]): Buffer[] {
  const size = 2 ** depthFor(leaves.length);
  const out = leaves.slice();
  while (out.length < size) out.push(EMPTY_HASH);
  return out;
}

export function computeRoot(leaves: Buffer[]): Buffer {
  if (leaves.length === 0) return EMPTY_HASH;
  let level = pad(leaves);
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(hashPair(level[i]!, level[i + 1]!));
    level = next;
  }
  return level[0]!;
}

export interface ProofStep {
  hash: string; // hex
  position: "left" | "right";
}

export interface MerkleProof {
  leafIndex: number;
  leafHash: string; // hex
  siblings: ProofStep[];
  root: string; // hex
  treeSize: number;
}

export function computeProof(leaves: Buffer[], index: number): MerkleProof {
  if (index < 0 || index >= leaves.length) throw new Error(`leaf index ${index} out of range`);
  let level = pad(leaves);
  const siblings: ProofStep[] = [];
  let idx = index;
  while (level.length > 1) {
    const isRight = idx % 2 === 1;
    const sibling = level[isRight ? idx - 1 : idx + 1]!;
    siblings.push({ hash: sibling.toString("hex"), position: isRight ? "left" : "right" });
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(hashPair(level[i]!, level[i + 1]!));
    level = next;
    idx = Math.floor(idx / 2);
  }
  return {
    leafIndex: index,
    leafHash: leaves[index]!.toString("hex"),
    siblings,
    root: computeRoot(leaves).toString("hex"),
    treeSize: leaves.length,
  };
}

/** Stateless verification — safe to run on the client with no server trust. */
export function verifyProof(proof: MerkleProof): boolean {
  let acc: Buffer = Buffer.from(proof.leafHash, "hex");
  for (const step of proof.siblings) {
    const sib = Buffer.from(step.hash, "hex");
    acc = step.position === "left" ? hashPair(sib, acc) : hashPair(acc, sib);
  }
  return acc.toString("hex") === proof.root;
}
