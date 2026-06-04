import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { newPrivateKey, publicKeyFromPrivate, ethAddress } from "../commitment/signer.js";

export interface TeeWallet {
  privateKey: Buffer;
  publicKey: Buffer; // uncompressed (0x04…)
  address: string; // Ethereum-style
  mode: "tee" | "dev";
}

/**
 * The commitment-signing identity.
 *
 * On EigenCompute the app runs in an Intel TDX enclave with a per-deployment
 * identity. We persist a secp256k1 key to the encrypted volume (`/data`), which
 * is accessible only to this attested image — so the key is sealed to the code.
 * On first boot it's generated; on resume it's loaded. Outside a TEE we mark the
 * wallet "dev" so verifiers don't mistake it for an attested deployment.
 */
export function initializeWallet(dataDir: string): TeeWallet {
  const keyPath = join(dataDir, "tee-wallet.key");
  let privateKey: Buffer;
  try {
    if (existsSync(keyPath)) {
      privateKey = Buffer.from(readFileSync(keyPath, "utf-8").trim(), "hex");
    } else {
      mkdirSync(dataDir, { recursive: true });
      privateKey = newPrivateKey();
      writeFileSync(keyPath, privateKey.toString("hex"), { mode: 0o600 });
    }
  } catch {
    // read-only/ephemeral FS (e.g. local sandbox) — fall back to an in-memory key
    privateKey = newPrivateKey();
  }
  const publicKey = publicKeyFromPrivate(privateKey);
  const insideTee = Boolean(process.env.ECLOUD_APP_ID) || existsSync("/usr/local/bin/kms-signing-public-key.pem");
  return { privateKey, publicKey, address: ethAddress(publicKey), mode: insideTee ? "tee" : "dev" };
}
