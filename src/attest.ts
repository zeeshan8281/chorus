import { generateKeyPair, type KeyPair } from "./crypto.js";

/**
 * The service's signing identity and where it came from.
 *
 * On EigenCompute the app runs inside an Intel TDX enclave and is handed a
 * signing key by the Key Management Service — and the KMS only releases that
 * key to the exact Docker image digest that was attested and whitelisted
 * onchain. So a valid TDX quote binding `signerPublicKey` to a known image
 * digest is what lets a client trust that the memory was committed by *this
 * code* and not by a tampering operator.
 *
 * Locally (no TEE) we fall back to an ephemeral key and mark mode "dev" so
 * nobody mistakes a laptop run for an attested one.
 */
export interface Attestation {
  mode: "tee" | "dev";
  /** Public key that signs Merkle roots. */
  signerPublicKey: string;
  /** Docker image digest the enclave is running (sha256:…), when in a TEE. */
  imageDigest?: string;
  /** Raw Intel TDX attestation quote (base64), when in a TEE. */
  tdxQuote?: string;
  /** EigenCompute application id, when deployed. */
  appId?: string;
  /** Where a verifier can independently check the quote ↔ digest binding. */
  verifyUrl?: string;
}

export interface Signer {
  keys: KeyPair;
  attestation: Attestation;
}

/**
 * Build the signer for this process.
 *
 * In the enclave EigenCompute injects the key material and attestation via
 * environment (SIGNER_PRIVATE_KEY / SIGNER_PUBLIC_KEY / TDX_QUOTE / IMAGE_DIGEST
 * / EIGEN_APP_ID). The `ecloud` runtime is the source of truth for the quote;
 * we surface it verbatim so clients verify against the Verifiability Dashboard.
 */
export function loadSigner(env: NodeJS.ProcessEnv = process.env): Signer {
  const priv = env.SIGNER_PRIVATE_KEY;
  const pub = env.SIGNER_PUBLIC_KEY;
  if (priv && pub) {
    return {
      keys: { privateKey: priv, publicKey: pub },
      attestation: {
        mode: "tee",
        signerPublicKey: pub,
        imageDigest: env.IMAGE_DIGEST,
        tdxQuote: env.TDX_QUOTE,
        appId: env.EIGEN_APP_ID,
        verifyUrl: env.EIGEN_VERIFY_URL ?? "https://docs.eigencloud.xyz/eigencompute/howto/operate/verify-trust-guarantees",
      },
    };
  }
  const keys = generateKeyPair();
  return { keys, attestation: { mode: "dev", signerPublicKey: keys.publicKey } };
}

/**
 * Client-side check that an attestation can be trusted.
 *
 * Full TDX quote parsing/verification is done against EigenCompute's KMS /
 * Verifiability Dashboard (out of scope to reimplement here); this enforces the
 * decision a client must make: the attestation must be TEE mode and its image
 * digest must match the digest the client expects (the one published on the
 * dashboard for this app). A "dev" attestation is never trusted in production.
 */
export function trustAttestation(att: Attestation, expectedImageDigest: string): { ok: boolean; reason?: string } {
  if (att.mode !== "tee") return { ok: false, reason: "attestation is dev-mode (not running in a TEE)" };
  if (!att.imageDigest) return { ok: false, reason: "attestation has no image digest" };
  if (!att.tdxQuote) return { ok: false, reason: "attestation has no TDX quote" };
  if (att.imageDigest !== expectedImageDigest) {
    return { ok: false, reason: `image digest ${att.imageDigest} != expected ${expectedImageDigest}` };
  }
  return { ok: true };
}
