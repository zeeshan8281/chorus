import type { MemoryRow, VersionRow, CommitmentLogRow, SearchFilter } from "../types.js";
import type { Store } from "./store.js";

/** In-memory store for tests, local dev, and the demo scripts. */
export class MemStore implements Store {
  private memories = new Map<string, MemoryRow>();
  private versions: VersionRow[] = [];
  private log: CommitmentLogRow[] = [];
  private leafList: Buffer[] = [];

  async init(): Promise<void> {}

  // No real isolation needed — single-process, synchronous maps.
  async withTransaction<T>(fn: (tx: Store) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async insertMemory(row: MemoryRow): Promise<void> {
    this.memories.set(row.id, { ...row });
  }
  async getMemory(id: string, includeDeleted = false): Promise<MemoryRow | undefined> {
    const row = this.memories.get(id);
    if (!row) return undefined;
    if (row.isDeleted && !includeDeleted) return undefined;
    return { ...row };
  }
  async updateMemory(row: MemoryRow): Promise<void> {
    this.memories.set(row.id, { ...row });
  }
  async search(f: SearchFilter): Promise<{ rows: MemoryRow[]; total: number }> {
    let rows = [...this.memories.values()];
    if (!f.includeDeleted) rows = rows.filter((r) => !r.isDeleted);
    if (f.agentId) rows = rows.filter((r) => r.agentId === f.agentId);
    if (f.tags?.length) rows = rows.filter((r) => f.tags!.every((t) => r.tags.includes(t)));
    if (f.since) rows = rows.filter((r) => r.createdAt >= f.since!);
    if (f.until) rows = rows.filter((r) => r.createdAt <= f.until!);
    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = rows.length;
    return { rows: rows.slice(f.offset, f.offset + f.limit).map((r) => ({ ...r })), total };
  }
  async getExpired(now: Date): Promise<MemoryRow[]> {
    return [...this.memories.values()].filter((r) => !r.isDeleted && r.expiresAt !== null && r.expiresAt <= now);
  }

  async insertVersion(v: VersionRow): Promise<void> {
    this.versions.push({ ...v });
  }
  async getVersions(memoryId: string): Promise<VersionRow[]> {
    return this.versions.filter((v) => v.memoryId === memoryId).sort((a, b) => a.version - b.version);
  }

  async appendCommitment(c: CommitmentLogRow): Promise<void> {
    this.log.push({ ...c });
  }

  async appendLeaf(hash: Buffer): Promise<number> {
    this.leafList.push(hash);
    return this.leafList.length - 1;
  }
  async leaves(): Promise<Buffer[]> {
    return this.leafList.map((b) => Buffer.from(b));
  }
  async leafCount(): Promise<number> {
    return this.leafList.length;
  }
}
