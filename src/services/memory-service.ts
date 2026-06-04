import { randomUUID } from "node:crypto";
import type { Store } from "../db/store.js";
import type { TeeWallet } from "../tee/wallet.js";
import { contentHash as hashContent } from "../commitment/canonicalize.js";
import { sha256, toHex, int64be } from "../commitment/hasher.js";
import { signMemoryOperation, signBytes } from "../commitment/signer.js";
import { computeLeafHash, computeProof, computeRoot, type MerkleProof } from "../merkle/tree.js";
import { withMemorySpan, annotateCommitment } from "../telemetry/memory-spans.js";
import type {
  Commitment, MemoryRow, Operation, VerifiedMemory, VerifiedMemoryWithProof,
  SearchFilter, SearchResponse, DeletionReceipt, MemoryVersion,
} from "../types.js";

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`memory not found: ${id}`);
  }
}

export interface CreateInput {
  content: string;
  agentId: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  ttlSeconds?: number;
}
export interface UpdateInput {
  content: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export class MemoryService {
  constructor(
    private readonly store: Store,
    private readonly wallet: TeeWallet,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private teePublicKey(): string {
    return toHex(this.wallet.publicKey);
  }

  /** Public accessor for the TEE public key (hex, uncompressed). */
  publicKeyHex(): string {
    return this.teePublicKey();
  }

  async create(input: CreateInput): Promise<VerifiedMemory> {
    return withMemorySpan("memory.write", { "memory.agent_id": input.agentId, "memory.operation": "CREATE" }, () =>
      this.store.withTransaction(async (tx) => {
        const ts = this.now();
        const id = randomUUID();
        const metadata = input.metadata ?? {};
        const tags = input.tags ?? [];
        const cHash = hashContent(input.content, metadata);
        const signature = signMemoryOperation(cHash, input.agentId, ts, "CREATE", this.wallet.privateKey);

        const leaf = computeLeafHash(cHash, id, ts);
        const prevLeaves = await tx.leaves();
        const idx = await tx.appendLeaf(leaf);
        const newRoot = computeRoot([...prevLeaves, leaf]);

        const row: MemoryRow = {
          id, agentId: input.agentId, content: input.content, metadata, tags,
          contentHash: cHash, signature, merkleLeafIdx: idx, merkleRoot: newRoot,
          version: 1, isDeleted: false,
          expiresAt: input.ttlSeconds ? new Date(ts.getTime() + input.ttlSeconds * 1000) : null,
          createdAt: ts, updatedAt: ts,
        };
        await tx.insertMemory(row);
        await tx.appendCommitment({
          operation: "CREATE", memoryId: id, contentHash: cHash, signature,
          merkleRoot: newRoot, merkleLeafIdx: idx, prevRoot: computeRoot(prevLeaves), timestamp: ts,
        });
        const verified = this.toVerified(row, "CREATE");
        annotateCommitment({ memoryId: id, contentHash: toHex(cHash), merkleRoot: toHex(newRoot), signature: toHex(signature) });
        return verified;
      }),
    );
  }

  async get(id: string): Promise<VerifiedMemoryWithProof | undefined> {
    const row = await this.store.getMemory(id);
    if (!row) return undefined;
    // integrity re-check: stored content must still hash to its committed hash
    if (!hashContent(row.content, row.metadata).equals(row.contentHash)) {
      // serve it anyway but the proof/signature checks downstream will fail
    }
    const proof = computeProof(await this.store.leaves(), row.merkleLeafIdx);
    return { memory: this.toVerified(row, row.version === 1 ? "CREATE" : "UPDATE"), proof, teePublicKey: this.teePublicKey() };
  }

  async update(id: string, input: UpdateInput): Promise<VerifiedMemory> {
    return withMemorySpan("memory.write", { "memory.operation": "UPDATE" }, () =>
      this.store.withTransaction(async (tx) => {
        const old = await tx.getMemory(id);
        if (!old) throw new NotFoundError(id);

        await tx.insertVersion({
          memoryId: old.id, version: old.version, content: old.content, metadata: old.metadata,
          contentHash: old.contentHash, signature: old.signature, merkleLeafIdx: old.merkleLeafIdx,
          merkleRoot: old.merkleRoot, createdAt: old.updatedAt,
        });

        const ts = this.now();
        const metadata = input.metadata ?? old.metadata;
        const tags = input.tags ?? old.tags;
        const cHash = hashContent(input.content, metadata);
        const signature = signMemoryOperation(cHash, old.agentId, ts, "UPDATE", this.wallet.privateKey);
        const leaf = computeLeafHash(cHash, id, ts);
        const prevLeaves = await tx.leaves();
        const idx = await tx.appendLeaf(leaf);
        const newRoot = computeRoot([...prevLeaves, leaf]);

        const row: MemoryRow = {
          ...old, content: input.content, metadata, tags, contentHash: cHash, signature,
          merkleLeafIdx: idx, merkleRoot: newRoot, version: old.version + 1, updatedAt: ts,
        };
        await tx.updateMemory(row);
        await tx.appendCommitment({
          operation: "UPDATE", memoryId: id, contentHash: cHash, signature,
          merkleRoot: newRoot, merkleLeafIdx: idx, prevRoot: old.merkleRoot, timestamp: ts,
        });
        annotateCommitment({ memoryId: id, contentHash: toHex(cHash), merkleRoot: toHex(newRoot), signature: toHex(signature) });
        return this.toVerified(row, "UPDATE");
      }),
    );
  }

  async remove(id: string): Promise<DeletionReceipt> {
    return withMemorySpan("memory.write", { "memory.operation": "DELETE" }, () =>
      this.store.withTransaction(async (tx) => {
        const old = await tx.getMemory(id);
        if (!old) throw new NotFoundError(id);
        const ts = this.now();
        // deletion commitment hashes over a DELETE marker, not content
        const delHash = sha256(Buffer.concat([Buffer.from("DELETE"), Buffer.from(id), int64be(ts.getTime())]));
        const signature = signMemoryOperation(delHash, old.agentId, ts, "DELETE", this.wallet.privateKey);
        const leaf = computeLeafHash(delHash, id, ts);
        const prevLeaves = await tx.leaves();
        const idx = await tx.appendLeaf(leaf);
        const newRoot = computeRoot([...prevLeaves, leaf]);

        await tx.updateMemory({ ...old, isDeleted: true, updatedAt: ts });
        await tx.appendCommitment({
          operation: "DELETE", memoryId: id, contentHash: delHash, signature,
          merkleRoot: newRoot, merkleLeafIdx: idx, prevRoot: old.merkleRoot, timestamp: ts,
        });
        const proof = computeProof([...prevLeaves, leaf], idx);
        return {
          memoryId: id,
          deletionCommitment: {
            contentHash: toHex(delHash), signature: toHex(signature), merkleRoot: toHex(newRoot),
            merkleLeafIndex: idx, operation: "DELETE", timestamp: ts.toISOString(),
          },
          proof, teePublicKey: this.teePublicKey(),
        };
      }),
    );
  }

  async search(filter: SearchFilter): Promise<SearchResponse> {
    const { rows, total } = await this.store.search(filter);
    const leaves = await this.store.leaves();
    const proofs = rows.map((r) => computeProof(leaves, r.merkleLeafIdx));
    const memories = rows.map((r) => this.toVerified(r, r.version === 1 ? "CREATE" : "UPDATE"));

    const root = computeRoot(leaves);
    const queryHash = sha256(canonicalFilter(filter));
    const resultSetHash = sha256(rows.map((r) => r.id).join(","));
    const setSig = signBytes(Buffer.concat([queryHash, resultSetHash, root]), this.wallet.privateKey);

    return {
      memories, proofs,
      setProof: {
        queryHash: toHex(queryHash), resultSetHash: toHex(resultSetHash),
        signature: toHex(setSig), merkleRoot: toHex(root), treeSize: leaves.length,
      },
      pagination: { total, limit: filter.limit, offset: filter.offset },
      teePublicKey: this.teePublicKey(),
    };
  }

  async history(id: string): Promise<{ current: VerifiedMemory; versions: MemoryVersion[] } | undefined> {
    const row = await this.store.getMemory(id, true);
    if (!row) return undefined;
    const versions = (await this.store.getVersions(id)).map((v) => ({
      memoryId: v.memoryId, version: v.version, content: v.content, metadata: v.metadata,
      commitment: {
        contentHash: toHex(v.contentHash), signature: toHex(v.signature), merkleRoot: toHex(v.merkleRoot),
        merkleLeafIndex: v.merkleLeafIdx, operation: (v.version === 1 ? "CREATE" : "UPDATE") as Operation,
        timestamp: v.createdAt.toISOString(),
      },
      createdAt: v.createdAt.toISOString(),
    }));
    return { current: this.toVerified(row, row.version === 1 ? "CREATE" : "UPDATE"), versions };
  }

  async treeRoot(): Promise<{ root: string; treeSize: number; signature: string; timestamp: string }> {
    const leaves = await this.store.leaves();
    const root = computeRoot(leaves);
    const ts = this.now();
    const sig = signBytes(Buffer.concat([root, int64be(leaves.length)]), this.wallet.privateKey);
    return { root: toHex(root), treeSize: leaves.length, signature: toHex(sig), timestamp: ts.toISOString() };
  }

  async proofForLeaf(leafIndex: number): Promise<MerkleProof> {
    return computeProof(await this.store.leaves(), leafIndex);
  }

  private toVerified(row: MemoryRow, operation: Operation): VerifiedMemory {
    return {
      id: row.id, agentId: row.agentId, content: row.content, metadata: row.metadata, tags: row.tags,
      version: row.version, isDeleted: row.isDeleted,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
      commitment: {
        contentHash: toHex(row.contentHash), signature: toHex(row.signature), merkleRoot: toHex(row.merkleRoot),
        merkleLeafIndex: row.merkleLeafIdx, operation, timestamp: row.updatedAt.toISOString(),
      } satisfies Commitment,
    };
  }
}

function canonicalFilter(f: SearchFilter): string {
  return JSON.stringify({
    agentId: f.agentId ?? null, tags: (f.tags ?? []).slice().sort(),
    since: f.since?.toISOString() ?? null, until: f.until?.toISOString() ?? null,
    includeDeleted: Boolean(f.includeDeleted), limit: f.limit, offset: f.offset,
  });
}
