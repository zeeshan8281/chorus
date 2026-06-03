import type { ProofStep } from "./merkle.js";
import type { InjectionVerdict } from "./inject.js";

export interface Agent {
  id: string;
  name: string;
  apiKey?: string;
  createdAt: string;
}

export interface MemoryInput {
  /** Logical partition (an agent, a user, a workspace). */
  namespace: string;
  content: string;
  /** Optional logical slot. A newer write to the same key supersedes the old. */
  key?: string;
  source?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** A committed memory. Its hash sits at `index` in the Merkle log. */
export interface MemoryEntry {
  id: string;
  namespace: string;
  content: string;
  key?: string;
  source?: string;
  authorAgentId: string;
  /** Position of this entry's leaf in the append-only Merkle log. */
  index: number;
  createdAt: string;
  /** sha256 of the canonical entry core — what the leaf commits to. */
  contentHash: string;
  tags: string[];
  metadata: Record<string, unknown>;
  /** True once superseded by a newer write to the same (namespace, key). */
  superseded: boolean;
}

/** The signed Merkle root after a write — the tamper-evidence anchor. */
export interface RootCommitment {
  /** Merkle root over all leaves up to `size`. */
  root: string;
  /** Number of leaves committed. */
  size: number;
  /** Ed25519 signature over canonical { root, size, signedAt } by the TEE key. */
  rootSignature: string;
  /** Public key whose authenticity is established by the TEE attestation. */
  signerPublicKey: string;
  signedAt: string;
}

/** Returned on write. */
export interface WriteReceipt {
  entry: MemoryEntry;
  leafHash: string;
  commitment: RootCommitment;
  injection: InjectionVerdict;
}

/** Raised when the injection gate blocks a write. */
export interface BlockedWrite {
  blocked: true;
  injection: InjectionVerdict;
}

/** A read together with everything a client needs to verify it. */
export interface VerifiableRead {
  entry: MemoryEntry;
  leafHash: string;
  proof: ProofStep[];
  commitment: RootCommitment;
}

export type { ProofStep } from "./merkle.js";
export type { InjectionVerdict } from "./inject.js";
