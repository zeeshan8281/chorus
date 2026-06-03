import { randomId, generateApiKey } from "./util.js";
import { InMemoryStore } from "./store/memory.js";
import type { Store, RecallQuery } from "./store/types.js";
import type {
  Agent,
  MemoryInput,
  MemoryEntry,
  RememberResult,
  ActivityEvent,
} from "./types.js";

export interface MemoryLayerOptions {
  store?: Store;
  /** Injectable clock for deterministic tests. Defaults to wall clock. */
  now?: () => Date;
}

/**
 * Shared memory for a team of agents.
 *
 * The job: many agents read and write one memory and stay in sync. Facts are
 * addressed by `key` within a `namespace`, so when a second agent learns
 * something newer it UPDATES the shared fact instead of piling on a duplicate —
 * and every contributor is tracked. An activity feed lets agents catch up on
 * what the others have learned since they last looked.
 */
export class MemoryLayer {
  readonly store: Store;
  private readonly now: () => Date;
  private seq = 0;
  private seqReady: Promise<void>;

  constructor(opts: MemoryLayerOptions = {}) {
    this.store = opts.store ?? new InMemoryStore();
    this.now = opts.now ?? (() => new Date());
    // Continue the activity sequence across restarts of a durable store.
    this.seqReady = this.store.lastSeq().then((s) => {
      this.seq = s;
    });
  }

  private iso(): string {
    return this.now().toISOString();
  }

  private async record(
    type: ActivityEvent["type"],
    entry: MemoryEntry,
    agentId: string,
  ): Promise<void> {
    await this.seqReady;
    const event: ActivityEvent = {
      seq: ++this.seq,
      type,
      namespace: entry.namespace,
      agentId,
      entryId: entry.id,
      key: entry.key,
      at: this.iso(),
    };
    await this.store.appendActivity(event);
  }

  /** Register an agent. Returns its identity (including a one-time apiKey). */
  async registerAgent(name: string): Promise<Agent> {
    const agent: Agent = {
      id: randomId("agent"),
      name,
      apiKey: generateApiKey(),
      createdAt: this.iso(),
    };
    await this.store.putAgent(agent);
    return agent;
  }

  /**
   * Remember a fact. If `key` is given and already exists in the namespace,
   * the shared entry is updated in place (revision bumped, contributor added);
   * otherwise a new entry is created.
   */
  async remember(agentId: string, input: MemoryInput): Promise<RememberResult> {
    const agent = await this.store.getAgent(agentId);
    if (!agent) throw new Error(`unknown agent: ${agentId}`);
    if (!input.namespace) throw new Error("namespace is required");
    if (!input.content) throw new Error("content is required");

    const at = this.iso();
    const existing = input.key
      ? await this.store.getByKey(input.namespace, input.key)
      : undefined;

    if (existing) {
      const previousContent = existing.content;
      const contributors = existing.contributors.includes(agentId)
        ? existing.contributors
        : [...existing.contributors, agentId];
      const entry: MemoryEntry = {
        ...existing,
        content: input.content,
        source: input.source ?? existing.source,
        authorAgentId: agentId,
        contributors,
        revision: existing.revision + 1,
        tags: input.tags ?? existing.tags,
        metadata: input.metadata ?? existing.metadata,
        updatedAt: at,
      };
      await this.store.putEntry(entry);
      await this.record("update", entry, agentId);
      return { entry, updated: true, previousContent };
    }

    const entry: MemoryEntry = {
      id: randomId("mem"),
      namespace: input.namespace,
      content: input.content,
      key: input.key,
      source: input.source,
      authorAgentId: agentId,
      contributors: [agentId],
      revision: 1,
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
      createdAt: at,
      updatedAt: at,
    };
    await this.store.putEntry(entry);
    await this.record("remember", entry, agentId);
    return { entry, updated: false };
  }

  /** Read shared memory by key, text, or tag. */
  async recall(query: RecallQuery): Promise<MemoryEntry[]> {
    return this.store.recall(query);
  }

  /** Get the single current entry for a key, if any. */
  async get(namespace: string, key: string): Promise<MemoryEntry | undefined> {
    return this.store.getByKey(namespace, key);
  }

  /** Retract a fact from shared memory. */
  async forget(agentId: string, namespace: string, ref: { key?: string; id?: string }): Promise<boolean> {
    const entry = ref.id
      ? await this.store.getEntry(ref.id)
      : ref.key
        ? await this.store.getByKey(namespace, ref.key)
        : undefined;
    if (!entry || entry.namespace !== namespace) return false;
    await this.store.deleteEntry(entry.id);
    await this.record("forget", entry, agentId);
    return true;
  }

  /**
   * What's happened in a namespace since `sinceSeq`. Agents poll this with the
   * last seq they saw to catch up on what other agents have learned.
   */
  async activity(namespace: string, sinceSeq = 0, limit?: number): Promise<ActivityEvent[]> {
    await this.seqReady;
    return this.store.activity(namespace, sinceSeq, limit);
  }
}
