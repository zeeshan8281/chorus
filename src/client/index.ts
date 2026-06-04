import { verifyMemory, type VerifyResult } from "./verifier.js";
import type {
  AttestationInfo, DeletionReceipt, MemoryVersion, SearchResponse,
  VerifiedMemory, VerifiedMemoryWithProof,
} from "../types.js";

export interface MemoryClientConfig {
  endpoint: string;
  agentId: string;
  /** Known attested TEE public key (from the Verifiability Dashboard). */
  teePublicKey?: string;
  /** Verify every read locally and throw on failure. Default true. */
  verifyProofs?: boolean;
}

/** Mem0-style client for the Verifiable Agent Memory service. */
export class VerifiableMemoryClient {
  constructor(private readonly config: MemoryClientConfig) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.config.endpoint}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  async add(content: string, opts: { metadata?: Record<string, unknown>; tags?: string[]; ttlSeconds?: number } = {}): Promise<VerifiedMemory> {
    return this.req("POST", "/v1/memories", { content, agentId: this.config.agentId, ...opts });
  }
  async update(id: string, content: string, opts: { metadata?: Record<string, unknown>; tags?: string[] } = {}): Promise<VerifiedMemory> {
    return this.req("PUT", `/v1/memories/${id}`, { content, ...opts });
  }
  async delete(id: string): Promise<DeletionReceipt> {
    return this.req("DELETE", `/v1/memories/${id}`);
  }

  async get(id: string): Promise<VerifiedMemoryWithProof> {
    const res = await this.req<VerifiedMemoryWithProof>("GET", `/v1/memories/${id}`);
    if (this.config.verifyProofs !== false) {
      const v = verifyMemory(res, this.config.teePublicKey);
      if (!v.ok) throw new Error(`memory verification failed: ${v.reasons.join("; ")}`);
    }
    return res;
  }
  async search(q: { tags?: string[]; since?: Date; until?: Date; limit?: number; offset?: number } = {}): Promise<SearchResponse> {
    const params = new URLSearchParams({ agentId: this.config.agentId });
    if (q.tags?.length) params.set("tags", q.tags.join(","));
    if (q.since) params.set("since", q.since.toISOString());
    if (q.until) params.set("until", q.until.toISOString());
    if (q.limit) params.set("limit", String(q.limit));
    if (q.offset) params.set("offset", String(q.offset));
    return this.req("GET", `/v1/memories?${params.toString()}`);
  }
  async history(id: string): Promise<{ memoryId: string; currentVersion: number; current: VerifiedMemory; versions: MemoryVersion[] }> {
    return this.req("GET", `/v1/memories/${id}/history`);
  }

  async getRoot(): Promise<{ root: string; treeSize: number; signature: string }> {
    return this.req("GET", "/v1/tree/root");
  }
  async getAttestation(): Promise<AttestationInfo> {
    return this.req("GET", "/v1/attestation");
  }

  verifyMemory(response: VerifiedMemoryWithProof): VerifyResult {
    return verifyMemory(response, this.config.teePublicKey);
  }
}

export { verifyMemory } from "./verifier.js";
export type { VerifyResult } from "./verifier.js";
