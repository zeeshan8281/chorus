import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { sha256, int64be, toHex } from "./hasher.js";
import type { Operation } from "../types.js";

/** Build the message digest that gets signed for a memory operation. */
function operationDigest(contentHash: Buffer, agentId: string, timestamp: Date, operation: Operation): Buffer {
  return sha256(
    Buffer.concat([contentHash, Buffer.from(agentId, "utf-8"), int64be(timestamp.getTime()), Buffer.from(operation, "utf-8")]),
  );
}

/** secp256k1 signature (compact 64-byte r‖s) over a memory operation. */
export function signMemoryOperation(
  contentHash: Buffer,
  agentId: string,
  timestamp: Date,
  operation: Operation,
  privateKey: Buffer,
): Buffer {
  const sig = secp256k1.sign(operationDigest(contentHash, agentId, timestamp, operation), privateKey);
  return Buffer.from(sig.toCompactRawBytes());
}

export function verifyMemorySignature(
  contentHash: Buffer,
  agentId: string,
  timestamp: Date,
  operation: Operation,
  signature: Buffer,
  publicKey: Buffer,
): boolean {
  try {
    return secp256k1.verify(signature, operationDigest(contentHash, agentId, timestamp, operation), publicKey);
  } catch {
    return false;
  }
}

/** Sign arbitrary bytes (used for the signed Merkle root and set-completeness proof). */
export function signBytes(message: Buffer, privateKey: Buffer): Buffer {
  return Buffer.from(secp256k1.sign(sha256(message), privateKey).toCompactRawBytes());
}
export function verifyBytes(message: Buffer, signature: Buffer, publicKey: Buffer): boolean {
  try {
    return secp256k1.verify(signature, sha256(message), publicKey);
  } catch {
    return false;
  }
}

export function publicKeyFromPrivate(privateKey: Buffer): Buffer {
  return Buffer.from(secp256k1.getPublicKey(privateKey, false)); // 65-byte uncompressed (0x04…)
}

/** Ethereum-style address from an uncompressed secp256k1 public key. */
export function ethAddress(publicKey: Buffer): string {
  const hash = keccak_256(publicKey.subarray(1)); // drop 0x04 prefix
  return "0x" + toHex(hash.subarray(-20));
}

export function newPrivateKey(): Buffer {
  return Buffer.from(secp256k1.utils.randomPrivateKey());
}
