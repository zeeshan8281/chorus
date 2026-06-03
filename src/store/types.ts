import type { Agent, MemoryEntry, ActivityEvent } from "../types.js";

export interface RecallQuery {
  namespace: string;
  /** Exact logical-slot match. */
  key?: string;
  /** Case-insensitive substring match over content. */
  text?: string;
  tag?: string;
  limit?: number;
}

/**
 * Storage backend for the shared-memory layer. Coordination semantics (upsert
 * by key, contributor tracking, the activity feed) live above this, so any
 * store — in-memory, file, Postgres — can be swapped in.
 */
export interface Store {
  putAgent(agent: Agent): Promise<void>;
  getAgent(id: string): Promise<Agent | undefined>;
  getAgentByApiKey(apiKey: string): Promise<Agent | undefined>;

  putEntry(entry: MemoryEntry): Promise<void>;
  getEntry(id: string): Promise<MemoryEntry | undefined>;
  /** The current entry for a (namespace, key), if one exists. */
  getByKey(namespace: string, key: string): Promise<MemoryEntry | undefined>;
  deleteEntry(id: string): Promise<void>;
  recall(query: RecallQuery): Promise<MemoryEntry[]>;

  appendActivity(event: ActivityEvent): Promise<void>;
  /** Events in a namespace with seq strictly greater than `sinceSeq`. */
  activity(namespace: string, sinceSeq: number, limit?: number): Promise<ActivityEvent[]>;
  /** Highest activity seq issued so far (0 if none). */
  lastSeq(): Promise<number>;
}
