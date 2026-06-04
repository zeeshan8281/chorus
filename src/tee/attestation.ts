import { existsSync, readFileSync } from "node:fs";
import { sha256, toHex } from "../commitment/hasher.js";
import type { TeeWallet } from "./wallet.js";
import type { AttestationInfo } from "../types.js";

const KMS_PUBKEY_PATH = "/usr/local/bin/kms-signing-public-key.pem";

/** Fingerprint of the EigenCompute KMS signing key present inside the enclave. */
function kmsKeyFingerprint(): string | null {
  try {
    if (!existsSync(KMS_PUBKEY_PATH)) return null;
    return "sha256:" + toHex(sha256(readFileSync(KMS_PUBKEY_PATH, "utf-8").trim()));
  } catch {
    return null;
  }
}

/**
 * Attestation a verifier uses to confirm this service runs the expected code in
 * a real TEE. The EigenCompute runtime injects ECLOUD_APP_ID / image digest /
 * TDX token; the KMS public key is mounted in the enclave. Verify against the
 * EigenCloud Verifiability Dashboard.
 */
export function getAttestation(wallet: TeeWallet, env: NodeJS.ProcessEnv = process.env): AttestationInfo {
  return {
    mode: wallet.mode,
    teePublicKey: toHex(wallet.publicKey),
    teeAddress: wallet.address,
    imageDigest: env.IMAGE_DIGEST ?? env.ECLOUD_IMAGE_DIGEST ?? null,
    attestationToken: env.TDX_QUOTE ?? env.ATTESTATION_TOKEN ?? null,
    onChainTxHash: env.ECLOUD_ONCHAIN_TX ?? null,
    eigenComputeDeploymentId: env.ECLOUD_APP_ID ?? null,
    kmsKeyFingerprint: kmsKeyFingerprint(),
    platform: "Intel TDX (EigenCompute)",
    confidentialSpace: "Google Cloud",
    verifyUrl: env.EIGEN_VERIFY_URL ?? "https://verify-sepolia.eigencloud.xyz",
  };
}
