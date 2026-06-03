import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Agent, MemoryEntry, ActivityEvent } from "../types.js";
import type { Store, RecallQuery } from "./types.js";
import { InMemoryStore } from "./memory.js";

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const out: T[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (t) out.push(JSON.parse(t) as T);
  }
  return out;
}

/**
 * Durable store backed by append-only JSONL files, replayed into an
 * InMemoryStore on startup. The latest line for a given entry id wins on
 * replay, so updates and deletes are captured without rewriting files.
 * Good for single-instance Railway deploys with a volume; swap in Postgres
 * for multi-instance.
 */
export class FileStore implements Store {
  private mem = new InMemoryStore();
  private readonly agentsPath: string;
  private readonly entriesPath: string;
  private readonly activityPath: string;

  private constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.agentsPath = join(dir, "agents.jsonl");
    this.entriesPath = join(dir, "entries.jsonl");
    this.activityPath = join(dir, "activity.jsonl");
  }

  static async open(dir: string): Promise<FileStore> {
    const fs = new FileStore(dir);
    for (const a of readJsonl<Agent>(fs.agentsPath)) await fs.mem.putAgent(a);
    for (const row of readJsonl<{ entry: MemoryEntry; deleted?: boolean }>(fs.entriesPath)) {
      if (row.deleted) await fs.mem.deleteEntry(row.entry.id);
      else await fs.mem.putEntry(row.entry);
    }
    for (const e of readJsonl<ActivityEvent>(fs.activityPath)) await fs.mem.appendActivity(e);
    return fs;
  }

  async putAgent(agent: Agent): Promise<void> {
    await this.mem.putAgent(agent);
    appendFileSync(this.agentsPath, JSON.stringify(agent) + "\n");
  }
  getAgent(id: string) {
    return this.mem.getAgent(id);
  }
  getAgentByApiKey(apiKey: string) {
    return this.mem.getAgentByApiKey(apiKey);
  }

  async putEntry(entry: MemoryEntry): Promise<void> {
    await this.mem.putEntry(entry);
    appendFileSync(this.entriesPath, JSON.stringify({ entry }) + "\n");
  }
  getEntry(id: string) {
    return this.mem.getEntry(id);
  }
  getByKey(namespace: string, key: string) {
    return this.mem.getByKey(namespace, key);
  }
  async deleteEntry(id: string): Promise<void> {
    const entry = await this.mem.getEntry(id);
    await this.mem.deleteEntry(id);
    if (entry) appendFileSync(this.entriesPath, JSON.stringify({ entry, deleted: true }) + "\n");
  }
  recall(q: RecallQuery) {
    return this.mem.recall(q);
  }

  async appendActivity(event: ActivityEvent): Promise<void> {
    await this.mem.appendActivity(event);
    appendFileSync(this.activityPath, JSON.stringify(event) + "\n");
  }
  activity(namespace: string, sinceSeq: number, limit?: number) {
    return this.mem.activity(namespace, sinceSeq, limit);
  }
  lastSeq() {
    return this.mem.lastSeq();
  }
}
