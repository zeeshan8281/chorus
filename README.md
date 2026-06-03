<div align="center">

# 🎶 Chorus

### Shared memory for multi-agent systems

**Your agents, on the same page.** One shared memory for your whole agent team — write facts by key, update them in place, track who contributed, and let any agent catch up on what the others learned.

[![Node](https://img.shields.io/badge/node-%E2%89%A522-3df08a)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.7-37b6ff)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-ffa12a)](LICENSE)

</div>

---

## Why

Most agent frameworks give every agent its own siloed memory. The moment you run more than one agent, that breaks down:

| Without shared memory | With Chorus |
| --- | --- |
| 🥶 **Cold start** — every agent re-learns the same context from scratch | Write a fact once; the whole team reuses it |
| 🧬 **Duplicates** — five agents store five copies of "the deploy target" | One fact per key, updated in place |
| 🌫️ **Drift** — one agent updates something, the others never find out | Agents catch up on exactly what changed |

Chorus is the **coordination layer** that sits in front of your store and keeps a team of agents in sync. It is not a vector database and not a verification product — it's the shared brain.

## How it works

Facts live in a **namespace** (a team, a project, a session) and are addressed by **key**. Writing to a key that already exists *updates the shared fact in place* instead of creating a duplicate, bumps a `revision`, and records the new author as a contributor. Every change lands on an **activity feed** that other agents poll with a cursor to stay in sync.

```
 agent A ──remember(key)──▶ ┌──────────────────────────┐
 agent B ──remember(key)──▶ │   one shared fact / key   │──┐
 agent C ──remember(key)──▶ │  revision++ · contributors│  │
                            └──────────────────────────┘  │
                                                           ▼
 agent D ──activity(since)──────────────────────▶  only what changed since my cursor
```

## Install

```bash
npm install chorus
```

> Requires Node ≥ 22.

## Quickstart

```ts
import { MemoryLayer } from "chorus";

const mem = new MemoryLayer();

const researcher = await mem.registerAgent("researcher");
const analyst    = await mem.registerAgent("analyst");
const executor   = await mem.registerAgent("executor");

// researcher writes a shared fact
await mem.remember(researcher.id, {
  namespace: "team:acme",
  key: "deploy.target",
  content: "staging",
});

// analyst learns something newer — this UPDATES the fact in place, no duplicate
const r = await mem.remember(analyst.id, {
  namespace: "team:acme",
  key: "deploy.target",
  content: "production",
});

r.updated;                  // true
r.previousContent;          // "staging"
r.entry.revision;           // 2
r.entry.contributors;       // [researcher.id, analyst.id]

// read the shared memory
await mem.recall({ namespace: "team:acme" });

// an agent that was away catches up on exactly what it missed
const events = await mem.activity("team:acme", /* sinceSeq */ 0);
```

Run the multi-agent demo:

```bash
git clone https://github.com/zeeshan8281/chorus.git
cd chorus && npm install
npm run example
```

## Core API

| Method | What it does |
| --- | --- |
| `registerAgent(name)` | Create an agent identity (returns an `apiKey` for HTTP use). |
| `remember(agentId, input)` | Create a fact, or **upsert** it if `input.key` already exists. Returns `{ entry, updated, previousContent? }`. |
| `recall(query)` | Read by `namespace` + optional `key` / `text` / `tag` / `limit`. |
| `get(namespace, key)` | Fetch the single current entry for a key. |
| `forget(agentId, namespace, { key \| id })` | Retract a fact from shared memory. |
| `activity(namespace, sinceSeq?)` | The events newer than a cursor — how agents stay in sync. |

A `MemoryEntry` carries `content`, `key`, `authorAgentId`, `contributors[]`, `revision`, `tags`, `metadata`, and `createdAt` / `updatedAt`.

## HTTP service

Chorus also runs as a small HTTP service, so non-TS agents can share the same memory.

```bash
npm run build && npm start          # in-memory
DATA_DIR=./data npm start           # durable (JSONL files, replayed on boot)
```

| Method & path | Purpose |
| --- | --- |
| `POST /v1/agents` | Register an agent → `{ id, name, apiKey }` |
| `POST /v1/memory` | Remember a fact (create `201` / update `200`) |
| `GET /v1/memory` | Recall (`?namespace=&key=&q=&tag=&limit=`) |
| `DELETE /v1/memory` | Forget (`?namespace=&key=` or `&id=`) |
| `GET /v1/activity` | Catch up (`?namespace=&since=`) → `{ cursor, events }` |
| `GET /health` | Liveness |

Authenticate with the agent's key: `Authorization: Bearer <apiKey>`.

```bash
KEY=$(curl -s -XPOST localhost:3000/v1/agents -d '{"name":"researcher"}' | jq -r .apiKey)

curl -XPOST localhost:3000/v1/memory -H "authorization: Bearer $KEY" \
  -d '{"namespace":"team:acme","key":"deploy.target","content":"production"}'

curl "localhost:3000/v1/memory?namespace=team:acme"      -H "authorization: Bearer $KEY"
curl "localhost:3000/v1/activity?namespace=team:acme&since=0" -H "authorization: Bearer $KEY"
```

## Deploy on Railway

A `railway.json` is included (Nixpacks build → `node dist/server.js`).

1. `railway init` and link this repo.
2. Set `DATA_DIR=/data` and attach a volume at `/data` for durability.
3. Deploy. Done.

> The default file-backed store is single-instance. For multi-instance, implement the `Store` interface (`src/store/types.ts`) against Postgres — the coordination logic doesn't change.

## Architecture

```
src/
  memory.ts      MemoryLayer — upsert-by-key, contributor tracking, activity feed
  types.ts       Agent · MemoryEntry · ActivityEvent · ...
  store/
    types.ts     Store interface (swap the backend without touching logic)
    memory.ts    InMemoryStore (zero-dep, default)
    file.ts      FileStore (append-only JSONL, replayed on boot)
  server.ts      Hono HTTP API
  util.ts        id / token helpers
site/            terminal-style landing page (open site/index.html)
```

Coordination semantics live **above** the `Store` interface, so the backend (in-memory, file, Postgres, or a vector DB) is pluggable.

## Development

```bash
npm install
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run example   # the multi-agent coordination demo
npm run dev       # HTTP service with hot reload
```

## License

MIT
