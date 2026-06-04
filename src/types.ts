import type { MerkleProof } from "./merkle/tree.js";

export type Operation = "CREATE" | "UPDATE" | "DELETE";

// ---------- API-facing types (hex-encoded crypto, ISO timestamps) ----------

export interface Memory {
  id: string;
  agentId: string;
  content: string;
  metadata: Record<string, unknown>;
  tags: string[];
  version: number;
  isDeleted: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Commitment {
  contentHash: string;
  signature: string;
  merkleRoot: string;
  merkleLeafIndex: number;
  operation: Operation;
  timestamp: string;
}

export interface VerifiedMemory extends Memory {
  commitment: Commitment;
}

export interface VerifiedMemoryWithProof {
  memory: VerifiedMemory;
  proof: MerkleProof;
  teePublicKey: string;
}

export interface SetCompletenessProof {
  queryHash: string;
  resultSetHash: string;
  signature: string;
  merkleRoot: string;
  treeSize: number;
}

export interface SearchResponse {
  memories: VerifiedMemory[];
  proofs: MerkleProof[];
  setProof: SetCompletenessProof;
  pagination: { total: number; limit: number; offset: number };
  teePublicKey: string;
}

export interface DeletionReceipt {
  memoryId: string;
  deletionCommitment: Commitment;
  proof: MerkleProof;
  teePublicKey: string;
}

export interface MemoryVersion {
  memoryId: string;
  version: number;
  content: string;
  metadata: Record<string, unknown>;
  commitment: Commitment;
  createdAt: string;
}

export interface AttestationInfo {
  mode: "tee" | "dev";
  teePublicKey: string;
  teeAddress: string;
  imageDigest: string | null;
  attestationToken: string | null;
  onChainTxHash: string | null;
  eigenComputeDeploymentId: string | null;
  kmsKeyFingerprint: string | null;
  platform: string;
  confidentialSpace: string;
  verifyUrl: string;
}

export type { MerkleProof, ProofStep } from "./merkle/tree.js";

// ---------- internal storage rows (Buffers for BYTEA, Dates) ----------

export interface MemoryRow {
  id: string;
  agentId: string;
  content: string;
  metadata: Record<string, unknown>;
  tags: string[];
  contentHash: Buffer;
  signature: Buffer;
  merkleLeafIdx: number;
  merkleRoot: Buffer;
  version: number;
  isDeleted: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VersionRow {
  memoryId: string;
  version: number;
  content: string;
  metadata: Record<string, unknown>;
  contentHash: Buffer;
  signature: Buffer;
  merkleLeafIdx: number;
  merkleRoot: Buffer;
  createdAt: Date;
}

export interface CommitmentLogRow {
  operation: Operation;
  memoryId: string;
  contentHash: Buffer;
  signature: Buffer;
  merkleRoot: Buffer;
  merkleLeafIdx: number;
  prevRoot: Buffer | null;
  timestamp: Date;
}

export interface SearchFilter {
  agentId?: string;
  tags?: string[];
  since?: Date;
  until?: Date;
  includeDeleted?: boolean;
  limit: number;
  offset: number;
}
