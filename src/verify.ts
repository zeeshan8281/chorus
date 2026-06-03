import { sha256Hex, canonicalize, verify as edVerify } from "./crypto.js";
import { verifyProof } from "./merkle.js";
import { computeLeaf } from "./memory.js";
import { trustAttestation, type Attestation } from "./attest.js";
import type { VerifiableRead } from "./types.js";

export interface VerifyResult {
  ok: boolean;
  checks: {
    attestation: boolean;
    rootSignature: boolean;
    inclusion: boolean;
    leafBinding: boolean;
  };
  reasons: string[];
}

/**
 * Fully verify a read on the client side — the whole point of the product.
 *
 *   1. attestation: the signer key belongs to the expected attested image
 *      (operator-can't-tamper). Pass `expectedImageDigest` from the
 *      Verifiability Dashboard; omit it only in dev.
 *   2. rootSignature: the signed root really came from that key.
 *   3. leafBinding: the returned entry actually hashes to the given leaf.
 *   4. inclusion: that leaf is in the tree under the signed root.
 *
 * All four must hold. If any fails, the memory is not trustworthy.
 */
export function verifyRead(
  read: VerifiableRead,
  attestation: Attestation,
  expectedImageDigest?: string,
): VerifyResult {
  const reasons: string[] = [];

  let attOk = true;
  if (expectedImageDigest) {
    const t = trustAttestation(attestation, expectedImageDigest);
    attOk = t.ok;
    if (!t.ok) reasons.push(`attestation: ${t.reason}`);
  } else if (attestation.mode !== "tee") {
    reasons.push("attestation: dev-mode key accepted (no expectedImageDigest given) — not production-safe");
  }

  const { commitment, entry, leafHash, proof } = read;

  const rootMsg = canonicalize({ root: commitment.root, size: commitment.size, signedAt: commitment.signedAt });
  const rootSignature = edVerify(rootMsg, commitment.rootSignature, commitment.signerPublicKey);
  if (!rootSignature) reasons.push("rootSignature: signed root failed signature check");

  if (commitment.signerPublicKey !== attestation.signerPublicKey) {
    reasons.push("rootSignature: signer key does not match attested key");
  }

  const leafBinding = computeLeaf(entry) === leafHash && entry.contentHash === sha256Hex(canonicalize({
    id: entry.id, namespace: entry.namespace, content: entry.content,
    key: entry.key ?? null, source: entry.source ?? null,
    authorAgentId: entry.authorAgentId, createdAt: entry.createdAt,
  }));
  if (!leafBinding) reasons.push("leafBinding: entry does not hash to its leaf (content tampered)");

  const inclusion = verifyProof(leafHash, proof, commitment.root);
  if (!inclusion) reasons.push("inclusion: leaf not present under the signed root");

  const keyMatches = commitment.signerPublicKey === attestation.signerPublicKey;
  return {
    ok: attOk && rootSignature && keyMatches && leafBinding && inclusion,
    checks: { attestation: attOk, rootSignature: rootSignature && keyMatches, inclusion, leafBinding },
    reasons,
  };
}
