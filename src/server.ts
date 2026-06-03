import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { VerifiableMemory } from "./memory.js";
import { loadSigner } from "./attest.js";
import { InMemoryStore } from "./store/memory.js";
import type { Store } from "./store/types.js";
import type { Agent } from "./types.js";

/**
 * Build the app. With DATABASE_URL set (the TEE/production path) it uses
 * PostgreSQL; otherwise in-memory for local dev.
 */
export async function createApp() {
  let store: Store;
  if (process.env.DATABASE_URL) {
    const { PostgresStore } = await import("./store/postgres.js");
    store = await PostgresStore.connect(process.env.DATABASE_URL);
  } else {
    store = new InMemoryStore();
  }
  const mem = new VerifiableMemory({ store, signer: loadSigner() });
  const app = new Hono();

  async function auth(c: { req: { header: (k: string) => string | undefined } }): Promise<Agent | undefined> {
    const h = c.req.header("authorization");
    const key = h?.startsWith("Bearer ") ? h.slice(7) : c.req.header("x-api-key");
    return key ? mem.store.getAgentByApiKey(key) : undefined;
  }

  app.get("/health", (c) => c.json({ ok: true, attestationMode: mem.attestation.mode }));

  // The enclave's attestation — clients fetch this and check it against the
  // EigenCompute Verifiability Dashboard before trusting any read.
  app.get("/v1/attestation", (c) => c.json(mem.attestation));

  app.post("/v1/agents", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const name = typeof body.name === "string" && body.name ? body.name : "agent";
    const a = await mem.registerAgent(name);
    return c.json({ id: a.id, name: a.name, apiKey: a.apiKey, createdAt: a.createdAt });
  });

  // Write a memory. 201 on commit, 422 when the injection gate blocks it.
  app.post("/v1/memory", async (c) => {
    const agent = await auth(c);
    if (!agent) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json().catch(() => null);
    if (!body?.namespace || !body?.content) return c.json({ error: "namespace and content are required" }, 400);
    try {
      const r = await mem.write(agent.id, {
        namespace: body.namespace, content: body.content, key: body.key,
        source: body.source, tags: body.tags, metadata: body.metadata,
      });
      if ("blocked" in r) return c.json({ blocked: true, injection: r.injection }, 422);
      return c.json(r, 201);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });

  // Read with a Merkle inclusion proof against the latest signed root.
  app.get("/v1/memory/:id", async (c) => {
    const agent = await auth(c);
    if (!agent) return c.json({ error: "unauthorized" }, 401);
    const read = await mem.readWithProof(c.req.param("id"));
    if (!read) return c.json({ error: "not found" }, 404);
    return c.json({ ...read, attestation: mem.attestation });
  });

  // Recall (no proofs — use the per-entry endpoint to verify).
  app.get("/v1/memory", async (c) => {
    const agent = await auth(c);
    if (!agent) return c.json({ error: "unauthorized" }, 401);
    const namespace = c.req.query("namespace");
    if (!namespace) return c.json({ error: "namespace is required" }, 400);
    const limit = c.req.query("limit");
    const entries = await mem.recall({
      namespace, key: c.req.query("key"), text: c.req.query("q"), tag: c.req.query("tag"),
      includeSuperseded: c.req.query("includeSuperseded") === "true",
      limit: limit ? Number(limit) : undefined,
    });
    return c.json({ namespace, entries });
  });

  // The current signed Merkle root.
  app.get("/v1/root", async (c) => {
    const root = await mem.latestRoot();
    return c.json({ root: root ?? null, attestation: mem.attestation });
  });

  return { app, mem };
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  createApp()
    .then(({ app, mem }) => serve({ fetch: app.fetch, port }, (i) =>
      console.log(`verifiable-memory listening on :${i.port} (attestation: ${mem.attestation.mode})`)))
    .catch((e) => { console.error("failed to start", e); process.exit(1); });
}
