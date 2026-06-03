import type { Agent, MemoryEntry, RootCommitment } from "../types.js";

export interface RecallQuery {
  namespace: string;
  key?: string;
  text?: string;
  tag?: string;
  /** Include entries superseded by a newer write to the same key. */
  includeSuperseded?: boolean;
  limit?: number;
}

/**
 * Storage backend. The verifiable layer (Merkle log, signing, attestation)
 * lives above this, so the same logic runs over an in-memory store in tests
 * and PostgreSQL inside the TEE in production.
 */
export interface Store {
  putAgent(a: Agent): Promise<void>;
  getAgent(id: string): Promise<Agent | undefined>;
  getAgentByApiKey(k: string): Promise<Agent | undefined>;

  /** Append a leaf hash; returns its index in the log. */
  appendLeaf(hash: string): Promise<number>;
  /** All leaf hashes in order (for root + proof computation). */
  leaves(): Promise<string[]>;
  leafCount(): Promise<number>;

  putEntry(e: MemoryEntry): Promise<void>;
  getEntry(id: string): Promise<MemoryEntry | undefined>;
  getByKey(namespace: string, key: string): Promise<MemoryEntry | undefined>;
  markSuperseded(id: string): Promise<void>;
  recall(q: RecallQuery): Promise<MemoryEntry[]>;

  /** Persist the latest signed root. */
  saveRoot(c: RootCommitment): Promise<void>;
  latestRoot(): Promise<RootCommitment | undefined>;
}
