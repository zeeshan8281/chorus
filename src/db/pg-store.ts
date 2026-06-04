import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { MemoryRow, VersionRow, CommitmentLogRow, SearchFilter } from "../types.js";
import type { Store } from "./store.js";

type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "schema.sql");

/** PostgreSQL store — the production backend, co-located inside the TEE. */
export class PgStore implements Store {
  private constructor(
    private readonly q: Queryable,
    private readonly pool: any,
  ) {}

  static async connect(connectionString: string): Promise<PgStore> {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString });
    const store = new PgStore(pool, pool);
    await store.init();
    return store;
  }

  async init(): Promise<void> {
    await this.q.query(readFileSync(SCHEMA_PATH, "utf-8"));
  }

  async withTransaction<T>(fn: (tx: Store) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(new PgStore(client, this.pool));
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async insertMemory(r: MemoryRow): Promise<void> {
    await this.q.query(
      `INSERT INTO memories(id,agent_id,content,metadata,tags,content_hash,signature,merkle_leaf_idx,merkle_root,version,is_deleted,expires_at,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [r.id, r.agentId, r.content, JSON.stringify(r.metadata), r.tags, r.contentHash, r.signature,
       r.merkleLeafIdx, r.merkleRoot, r.version, r.isDeleted, r.expiresAt, r.createdAt, r.updatedAt],
    );
  }
  async getMemory(id: string, includeDeleted = false): Promise<MemoryRow | undefined> {
    const { rows } = await this.q.query(
      `SELECT * FROM memories WHERE id=$1 ${includeDeleted ? "" : "AND is_deleted=FALSE"}`, [id]);
    return rows[0] ? this.row(rows[0]) : undefined;
  }
  async updateMemory(r: MemoryRow): Promise<void> {
    await this.q.query(
      `UPDATE memories SET content=$2,metadata=$3,tags=$4,content_hash=$5,signature=$6,
         merkle_leaf_idx=$7,merkle_root=$8,version=$9,is_deleted=$10,expires_at=$11,updated_at=$12 WHERE id=$1`,
      [r.id, r.content, JSON.stringify(r.metadata), r.tags, r.contentHash, r.signature,
       r.merkleLeafIdx, r.merkleRoot, r.version, r.isDeleted, r.expiresAt, r.updatedAt],
    );
  }
  async search(f: SearchFilter): Promise<{ rows: MemoryRow[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (!f.includeDeleted) where.push("is_deleted=FALSE");
    if (f.agentId) { params.push(f.agentId); where.push(`agent_id=$${params.length}`); }
    if (f.tags?.length) { params.push(f.tags); where.push(`tags @> $${params.length}`); }
    if (f.since) { params.push(f.since); where.push(`created_at >= $${params.length}`); }
    if (f.until) { params.push(f.until); where.push(`created_at <= $${params.length}`); }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const totalRes = await this.q.query(`SELECT COUNT(*)::int AS c FROM memories ${clause}`, params);
    params.push(f.limit, f.offset);
    const { rows } = await this.q.query(
      `SELECT * FROM memories ${clause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { rows: rows.map((r) => this.row(r)), total: totalRes.rows[0].c };
  }
  async getExpired(now: Date): Promise<MemoryRow[]> {
    const { rows } = await this.q.query(
      `SELECT * FROM memories WHERE is_deleted=FALSE AND expires_at IS NOT NULL AND expires_at<=$1`, [now]);
    return rows.map((r) => this.row(r));
  }

  async insertVersion(v: VersionRow): Promise<void> {
    await this.q.query(
      `INSERT INTO memory_versions(memory_id,version,content,metadata,content_hash,signature,merkle_leaf_idx,merkle_root,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [v.memoryId, v.version, v.content, JSON.stringify(v.metadata), v.contentHash, v.signature, v.merkleLeafIdx, v.merkleRoot, v.createdAt]);
  }
  async getVersions(memoryId: string): Promise<VersionRow[]> {
    const { rows } = await this.q.query(`SELECT * FROM memory_versions WHERE memory_id=$1 ORDER BY version ASC`, [memoryId]);
    return rows.map((r) => ({
      memoryId: r.memory_id, version: r.version, content: r.content,
      metadata: typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata,
      contentHash: r.content_hash, signature: r.signature, merkleLeafIdx: Number(r.merkle_leaf_idx),
      merkleRoot: r.merkle_root, createdAt: r.created_at,
    }));
  }

  async appendCommitment(c: CommitmentLogRow): Promise<void> {
    await this.q.query(
      `INSERT INTO commitment_log(operation,memory_id,content_hash,signature,merkle_root,merkle_leaf_idx,prev_root,timestamp)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [c.operation, c.memoryId, c.contentHash, c.signature, c.merkleRoot, c.merkleLeafIdx, c.prevRoot, c.timestamp]);
  }

  async appendLeaf(hash: Buffer): Promise<number> {
    const { rows } = await this.q.query(
      `INSERT INTO merkle_nodes(level,idx,hash)
       VALUES(0,(SELECT COALESCE(MAX(idx)+1,0) FROM merkle_nodes WHERE level=0),$1) RETURNING idx`, [hash]);
    return Number(rows[0].idx);
  }
  async leaves(): Promise<Buffer[]> {
    const { rows } = await this.q.query(`SELECT hash FROM merkle_nodes WHERE level=0 ORDER BY idx ASC`);
    return rows.map((r) => r.hash as Buffer);
  }
  async leafCount(): Promise<number> {
    const { rows } = await this.q.query(`SELECT COUNT(*)::int AS c FROM merkle_nodes WHERE level=0`);
    return rows[0].c as number;
  }

  private row(r: any): MemoryRow {
    return {
      id: r.id, agentId: r.agent_id, content: r.content,
      metadata: typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata,
      tags: r.tags ?? [], contentHash: r.content_hash, signature: r.signature,
      merkleLeafIdx: Number(r.merkle_leaf_idx), merkleRoot: r.merkle_root, version: r.version,
      isDeleted: r.is_deleted, expiresAt: r.expires_at, createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }
}
