import type { Agent, MemoryEntry, RootCommitment } from "../types.js";
import type { Store, RecallQuery } from "./types.js";

/**
 * PostgreSQL-backed store — the production backend, intended to run alongside
 * the service inside the TEE (encrypted memory + sealed disk). `pg` is an
 * optional dependency: this module is only imported when DATABASE_URL is set.
 *
 * The append-only `leaves` table is the spine of the Merkle log; `roots` keeps
 * the signed-root history so the latest commitment survives restarts.
 */
export class PostgresStore implements Store {
  // typed loosely to avoid a hard dependency on `pg` types at build time
  private pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

  private constructor(pool: any) {
    this.pool = pool;
  }

  static async connect(connectionString: string): Promise<PostgresStore> {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString });
    const store = new PostgresStore(pool);
    await store.migrate();
    return store;
  }

  private async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id text PRIMARY KEY, name text NOT NULL, api_key text UNIQUE, created_at text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS leaves (
        idx bigint PRIMARY KEY, hash text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS entries (
        id text PRIMARY KEY, namespace text NOT NULL, content text NOT NULL, key text,
        source text, author_agent_id text NOT NULL, idx bigint NOT NULL, created_at text NOT NULL,
        content_hash text NOT NULL, tags jsonb NOT NULL DEFAULT '[]', metadata jsonb NOT NULL DEFAULT '{}',
        superseded boolean NOT NULL DEFAULT false
      );
      CREATE INDEX IF NOT EXISTS entries_ns ON entries(namespace);
      CREATE UNIQUE INDEX IF NOT EXISTS entries_active_key ON entries(namespace, key) WHERE key IS NOT NULL AND NOT superseded;
      CREATE TABLE IF NOT EXISTS roots (
        size bigint PRIMARY KEY, root text NOT NULL, root_signature text NOT NULL,
        signer_public_key text NOT NULL, signed_at text NOT NULL
      );
    `);
  }

  async putAgent(a: Agent) {
    await this.pool.query(
      `INSERT INTO agents(id,name,api_key,created_at) VALUES($1,$2,$3,$4)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name`,
      [a.id, a.name, a.apiKey ?? null, a.createdAt],
    );
  }
  async getAgent(id: string) {
    const { rows } = await this.pool.query(`SELECT * FROM agents WHERE id=$1`, [id]);
    return rows[0] ? this.rowAgent(rows[0]) : undefined;
  }
  async getAgentByApiKey(key: string) {
    const { rows } = await this.pool.query(`SELECT * FROM agents WHERE api_key=$1`, [key]);
    return rows[0] ? this.rowAgent(rows[0]) : undefined;
  }
  private rowAgent(r: any): Agent {
    return { id: r.id, name: r.name, apiKey: r.api_key ?? undefined, createdAt: r.created_at };
  }

  async appendLeaf(hash: string) {
    const { rows } = await this.pool.query(
      `INSERT INTO leaves(idx,hash) VALUES((SELECT COALESCE(MAX(idx)+1,0) FROM leaves),$1) RETURNING idx`,
      [hash],
    );
    return Number(rows[0].idx);
  }
  async leaves() {
    const { rows } = await this.pool.query(`SELECT hash FROM leaves ORDER BY idx ASC`);
    return rows.map((r) => r.hash as string);
  }
  async leafCount() {
    const { rows } = await this.pool.query(`SELECT COUNT(*)::int AS c FROM leaves`);
    return rows[0].c as number;
  }

  async putEntry(e: MemoryEntry) {
    await this.pool.query(
      `INSERT INTO entries(id,namespace,content,key,source,author_agent_id,idx,created_at,content_hash,tags,metadata,superseded)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT(id) DO UPDATE SET superseded=excluded.superseded`,
      [e.id, e.namespace, e.content, e.key ?? null, e.source ?? null, e.authorAgentId, e.index,
       e.createdAt, e.contentHash, JSON.stringify(e.tags), JSON.stringify(e.metadata), e.superseded],
    );
  }
  async getEntry(id: string) {
    const { rows } = await this.pool.query(`SELECT * FROM entries WHERE id=$1`, [id]);
    return rows[0] ? this.rowEntry(rows[0]) : undefined;
  }
  async getByKey(ns: string, key: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM entries WHERE namespace=$1 AND key=$2 AND NOT superseded LIMIT 1`, [ns, key]);
    return rows[0] ? this.rowEntry(rows[0]) : undefined;
  }
  async markSuperseded(id: string) {
    await this.pool.query(`UPDATE entries SET superseded=true WHERE id=$1`, [id]);
  }
  async recall(q: RecallQuery) {
    const where = ["namespace=$1"];
    const params: unknown[] = [q.namespace];
    if (!q.includeSuperseded) where.push("NOT superseded");
    if (q.key !== undefined) { params.push(q.key); where.push(`key=$${params.length}`); }
    if (q.text) { params.push(`%${q.text}%`); where.push(`content ILIKE $${params.length}`); }
    if (q.tag) { params.push(JSON.stringify([q.tag])); where.push(`tags @> $${params.length}::jsonb`); }
    let sql = `SELECT * FROM entries WHERE ${where.join(" AND ")} ORDER BY idx DESC`;
    if (q.limit) { params.push(q.limit); sql += ` LIMIT $${params.length}`; }
    const { rows } = await this.pool.query(sql, params);
    return rows.map((r) => this.rowEntry(r));
  }
  private rowEntry(r: any): MemoryEntry {
    return {
      id: r.id, namespace: r.namespace, content: r.content, key: r.key ?? undefined,
      source: r.source ?? undefined, authorAgentId: r.author_agent_id, index: Number(r.idx),
      createdAt: r.created_at, contentHash: r.content_hash,
      tags: typeof r.tags === "string" ? JSON.parse(r.tags) : r.tags,
      metadata: typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata,
      superseded: r.superseded,
    };
  }

  async saveRoot(c: RootCommitment) {
    await this.pool.query(
      `INSERT INTO roots(size,root,root_signature,signer_public_key,signed_at) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(size) DO NOTHING`,
      [c.size, c.root, c.rootSignature, c.signerPublicKey, c.signedAt],
    );
  }
  async latestRoot() {
    const { rows } = await this.pool.query(`SELECT * FROM roots ORDER BY size DESC LIMIT 1`);
    const r = rows[0];
    return r ? { root: r.root, size: Number(r.size), rootSignature: r.root_signature, signerPublicKey: r.signer_public_key, signedAt: r.signed_at } : undefined;
  }
}
