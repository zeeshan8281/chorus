/** A participant that reads from and writes to shared memory. */
export interface Agent {
  id: string;
  name: string;
  /** Bearer token for HTTP auth. Just an access credential — not a signing key. */
  apiKey?: string;
  createdAt: string;
}

/** Caller-supplied fields for remembering something. */
export interface MemoryInput {
  /** The shared space this fact lives in (a team, a project, a session). */
  namespace: string;
  /** The fact itself. */
  content: string;
  /**
   * Optional logical slot, e.g. "user.timezone" or "deploy.target". Writing to
   * an existing key in the same namespace UPDATES that fact (coordination),
   * rather than creating a duplicate. Omit it for free-form notes.
   */
  key?: string;
  /** Where it came from (a tool, a url, the user, another agent). */
  source?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** A shared memory entry. */
export interface MemoryEntry {
  id: string;
  namespace: string;
  content: string;
  key?: string;
  source?: string;
  /** The agent that wrote the current value. */
  authorAgentId: string;
  /** Every agent that has contributed to this entry over its lifetime. */
  contributors: string[];
  /** Bumps each time the entry is updated — lets agents detect changes. */
  revision: number;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Result of a write: the entry, and what (if anything) it replaced. */
export interface RememberResult {
  entry: MemoryEntry;
  /** True when this updated an existing keyed entry instead of creating one. */
  updated: boolean;
  /** The prior content, when an existing entry was overwritten by a new author. */
  previousContent?: string;
}

/** A change in a namespace, for agents catching up on what others have learned. */
export interface ActivityEvent {
  /** Monotonic per-layer sequence number — use as a catch-up cursor. */
  seq: number;
  type: "remember" | "update" | "forget";
  namespace: string;
  agentId: string;
  entryId: string;
  key?: string;
  at: string;
}
