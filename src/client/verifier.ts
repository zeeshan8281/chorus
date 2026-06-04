import { contentHash as hashContent } from "../commitment/canonicalize.js";
import { fromHex } from "../commitment/hasher.js";
import { verifyMemorySignature } from "../commitment/signer.js";
import { computeLeafHash, verifyProof } from "../merkle/tree.js";
import type { VerifiedMemoryWithProof } from "../types.js";

export interface VerifyResult {
  ok: boolean;
  checks: {
    teeKey: boolean;
    contentHash: boolean;
    signature: boolean;
    leafBinding: boolean;
    inclusion: boolean;
    rootMatch: boolean;
  };
  reasons: string[];
}

/**
 * Independently verify a memory read — no trust in the server required.
 * Mirrors PRD §7.3. Pass `knownTeePublicKey` (from the on-chain / dashboard
 * attestation) to bind the proof to the attested code.
 */
export function verifyMemory(response: VerifiedMemoryWithProof, knownTeePublicKey?: string): VerifyResult {
  const { memory, proof, teePublicKey } = response;
  const c = memory.commitment;
  const reasons: string[] = [];

  const teeKey = !knownTeePublicKey || teePublicKey === knownTeePublicKey;
  if (!teeKey) reasons.push("teeKey: server key does not match the known attested key");

  const recomputed = hashContent(memory.content, memory.metadata);
  const contentHashOk = recomputed.toString("hex") === c.contentHash;
  if (!contentHashOk) reasons.push("contentHash: content does not hash to the committed hash (tampered)");

  const ts = new Date(c.timestamp);
  const signature = c.operation === "DELETE"
    ? true // deletion commitments are verified via the DeletionReceipt path
    : verifyMemorySignature(recomputed, memory.agentId, ts, c.operation, fromHex(c.signature), fromHex(teePublicKey));
  if (!signature) reasons.push("signature: commitment signature invalid for the TEE key");

  const expectedLeaf = computeLeafHash(recomputed, memory.id, ts).toString("hex");
  const leafBinding = expectedLeaf === proof.leafHash;
  if (!leafBinding) reasons.push("leafBinding: entry does not match its committed Merkle leaf");

  const inclusion = verifyProof(proof);
  if (!inclusion) reasons.push("inclusion: Merkle proof does not reconstruct the root");

  const rootMatch = proof.root === c.merkleRoot;
  if (!rootMatch) reasons.push("rootMatch: proof root != commitment root");

  return {
    ok: teeKey && contentHashOk && signature && leafBinding && inclusion && rootMatch,
    checks: { teeKey, contentHash: contentHashOk, signature, leafBinding, inclusion, rootMatch },
    reasons,
  };
}
