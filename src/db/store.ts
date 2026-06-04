import type { MemoryRow, VersionRow, CommitmentLogRow, SearchFilter } from "../types.js";

/**
 * Storage backend. The commitment/Merkle/signing logic lives above this so the
 * exact same service code runs over an in-memory store (tests, dev) and
 * PostgreSQL inside the TEE (production). Leaf hashes are persisted as level-0
 * merkle_nodes; the tree is recomputed from them (PRD §12 #1).
 */
export interface Store {
  init(): Promise<void>;
  withTransaction<T>(fn: (tx: Store) => Promise<T>): Promise<T>;

  // memories
  insertMemory(row: MemoryRow): Promise<void>;
  getMemory(id: string, includeDeleted?: boolean): Promise<MemoryRow | undefined>;
  updateMemory(row: MemoryRow): Promise<void>;
  search(filter: SearchFilter): Promise<{ rows: MemoryRow[]; total: number }>;
  getExpired(now: Date): Promise<MemoryRow[]>;

  // versions
  insertVersion(v: VersionRow): Promise<void>;
  getVersions(memoryId: string): Promise<VersionRow[]>;

  // commitment log
  appendCommitment(c: CommitmentLogRow): Promise<void>;

  // merkle leaves (level-0 nodes)
  appendLeaf(hash: Buffer): Promise<number>; // returns leaf index
  leaves(): Promise<Buffer[]>;
  leafCount(): Promise<number>;
}
