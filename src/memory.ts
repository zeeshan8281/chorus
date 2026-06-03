import { sha256Hex, canonicalize, sign, randomId, generateApiKey } from "./crypto.js";
import { leafHash, computeRoot, computeProof } from "./merkle.js";
import { HeuristicInjectionGate, type InjectionGate } from "./inject.js";
import { loadSigner, type Signer, type Attestation } from "./attest.js";
import { InMemoryStore } from "./store/memory.js";
import type { Store, RecallQuery } from "./store/types.js";
import type {
  Agent, MemoryInput, MemoryEntry, RootCommitment, WriteReceipt, BlockedWrite, VerifiableRead,
} from "./types.js";

/** Canonical core of an entry — the bytes the content hash commits to. */
function entryCore(e: Pick<MemoryEntry, "id" | "namespace" | "content" | "key" | "source" | "authorAgentId" | "createdAt">) {
  return canonicalize({
    id: e.id, namespace: e.namespace, content: e.content,
    key: e.key ?? null, source: e.source ?? null,
    authorAgentId: e.authorAgentId, createdAt: e.createdAt,
  });
}

/** The leaf payload bound into the Merkle log for an entry. */
function leafPayload(e: MemoryEntry): string {
  return sha256Hex(canonicalize({ index: e.index, contentHash: e.contentHash, authorAgentId: e.authorAgentId, createdAt: e.createdAt }));
}
export function computeLeaf(e: MemoryEntry): string {
  return leafHash(leafPayload(e));
}

export interface VerifiableMemoryOptions {
  store?: Store;
  gate?: InjectionGate;
  signer?: Signer;
  now?: () => Date;
}

/**
 * Verifiable, injection-resistant agent memory.
 *
 *  write → injection gate → hash + timestamp → append to Merkle log
 *        → sign the new root with the TEE-bound key
 *  read  → entry + Merkle inclusion proof + signed root
 *
 * Because the signing key only exists inside the attested enclave, a tampering
 * operator cannot forge an entry or rewrite history without changing the image
 * digest — which breaks attestation. Clients verify with `verifyRead`.
 */
export class VerifiableMemory {
  readonly store: Store;
  private readonly gate: InjectionGate;
  private readonly signer: Signer;
  private readonly now: () => Date;
  private chain: Promise<unknown> = Promise.resolve(); // serialize appends → consistent roots

  constructor(opts: VerifiableMemoryOptions = {}) {
    this.store = opts.store ?? new InMemoryStore();
    this.gate = opts.gate ?? new HeuristicInjectionGate();
    this.signer = opts.signer ?? loadSigner();
    this.now = opts.now ?? (() => new Date());
  }

  get attestation(): Attestation {
    return this.signer.attestation;
  }
  private iso() {
    return this.now().toISOString();
  }

  async registerAgent(name: string): Promise<Agent> {
    const agent: Agent = { id: randomId("agent"), name, apiKey: generateApiKey(), createdAt: this.iso() };
    await this.store.putAgent(agent);
    return agent;
  }

  /** Sign the current Merkle root over all committed leaves. */
  private async commitRoot(): Promise<RootCommitment> {
    const leaves = await this.store.leaves();
    const root = computeRoot(leaves);
    const size = leaves.length;
    const signedAt = this.iso();
    const rootSignature = sign(canonicalize({ root, size, signedAt }), this.signer.keys.privateKey);
    const commitment: RootCommitment = { root, size, rootSignature, signerPublicKey: this.signer.keys.publicKey, signedAt };
    await this.store.saveRoot(commitment);
    return commitment;
  }

  /** Write a memory. Blocked writes are never committed to the log. */
  async write(agentId: string, input: MemoryInput): Promise<WriteReceipt | BlockedWrite> {
    const agent = await this.store.getAgent(agentId);
    if (!agent) throw new Error(`unknown agent: ${agentId}`);
    if (!input.namespace || !input.content) throw new Error("namespace and content are required");

    const injection = await this.gate.inspect(input);
    if (injection.blocked) return { blocked: true, injection };

    // Serialize the read-modify-write of the log so concurrent writes get
    // distinct indices and a consistent signed root.
    const run = this.chain.then(async () => {
      const createdAt = this.iso();
      const id = randomId("mem");
      const contentHash = sha256Hex(entryCore({
        id, namespace: input.namespace, content: input.content,
        key: input.key, source: input.source, authorAgentId: agentId, createdAt,
      }));

      if (input.key) {
        const prior = await this.store.getByKey(input.namespace, input.key);
        if (prior) await this.store.markSuperseded(prior.id);
      }

      const index = await this.store.leafCount();
      const entry: MemoryEntry = {
        id, namespace: input.namespace, content: input.content, key: input.key,
        source: input.source, authorAgentId: agentId, index, createdAt, contentHash,
        tags: input.tags ?? [], metadata: input.metadata ?? {}, superseded: false,
      };
      const lh = computeLeaf(entry);
      await this.store.appendLeaf(lh);
      await this.store.putEntry(entry);
      const commitment = await this.commitRoot();
      return { entry, leafHash: lh, commitment, injection } satisfies WriteReceipt;
    });
    this.chain = run.catch(() => {});
    return run;
  }

  /** Read one entry with a Merkle inclusion proof against the latest signed root. */
  async readWithProof(id: string): Promise<VerifiableRead | undefined> {
    const entry = await this.store.getEntry(id);
    if (!entry) return undefined;
    const leaves = await this.store.leaves();
    const proof = computeProof(leaves, entry.index);
    const commitment = (await this.store.latestRoot()) ?? (await this.commitRoot());
    return { entry, leafHash: computeLeaf(entry), proof, commitment };
  }

  async recall(query: RecallQuery): Promise<MemoryEntry[]> {
    return this.store.recall(query);
  }
  async get(namespace: string, key: string): Promise<MemoryEntry | undefined> {
    return this.store.getByKey(namespace, key);
  }
  async latestRoot(): Promise<RootCommitment | undefined> {
    return this.store.latestRoot();
  }
}
