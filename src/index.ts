// Service + server
export { createApp } from "./server.js";
export { MemoryService, NotFoundError } from "./services/memory-service.js";
export type { CreateInput, UpdateInput } from "./services/memory-service.js";
export { startExpirationSweep } from "./services/expiration-service.js";

// Stores
export { MemStore } from "./db/mem-store.js";
export { PgStore } from "./db/pg-store.js";
export type { Store } from "./db/store.js";

// Commitment + Merkle primitives
export { canonicalize, contentHash } from "./commitment/canonicalize.js";
export { sha256, toHex, fromHex } from "./commitment/hasher.js";
export {
  signMemoryOperation, verifyMemorySignature, signBytes, verifyBytes,
  publicKeyFromPrivate, ethAddress, newPrivateKey,
} from "./commitment/signer.js";
export {
  EMPTY_HASH, computeLeafHash, computeRoot, computeProof, verifyProof,
} from "./merkle/tree.js";

// TEE
export { initializeWallet } from "./tee/wallet.js";
export type { TeeWallet } from "./tee/wallet.js";
export { getAttestation } from "./tee/attestation.js";

// Client-side verification
export { verifyMemory } from "./client/verifier.js";
export type { VerifyResult } from "./client/verifier.js";

export * from "./types.js";
