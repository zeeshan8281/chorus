import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { MemoryLayer } from "./memory.js";
import { FileStore } from "./store/file.js";
import { InMemoryStore } from "./store/memory.js";
import type { Agent } from "./types.js";

/** Build the app. With DATA_DIR set, state is durable; otherwise in-memory. */
export async function createApp() {
  const dataDir = process.env.DATA_DIR;
  const store = dataDir ? await FileStore.open(dataDir) : new InMemoryStore();
  const layer = new MemoryLayer({ store });
  const app = new Hono();

  async function authAgent(c: { req: { header: (k: string) => string | undefined } }): Promise<Agent | undefined> {
    const header = c.req.header("authorization");
    const key = header?.startsWith("Bearer ") ? header.slice(7) : c.req.header("x-api-key");
    if (!key) return undefined;
    return layer.store.getAgentByApiKey(key);
  }

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/v1/agents", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const name = typeof body.name === "string" && body.name ? body.name : "unnamed-agent";
    const agent = await layer.registerAgent(name);
    return c.json({ id: agent.id, name: agent.name, apiKey: agent.apiKey, createdAt: agent.createdAt });
  });

  // Remember (create or update a shared fact).
  app.post("/v1/memory", async (c) => {
    const agent = await authAgent(c);
    if (!agent) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json().catch(() => null);
    if (!body?.namespace || !body?.content) {
      return c.json({ error: "namespace and content are required" }, 400);
    }
    try {
      const result = await layer.remember(agent.id, {
        namespace: body.namespace,
        content: body.content,
        key: body.key,
        source: body.source,
        tags: body.tags,
        metadata: body.metadata,
      });
      return c.json(result, result.updated ? 200 : 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  // Recall shared memory.
  app.get("/v1/memory", async (c) => {
    const agent = await authAgent(c);
    if (!agent) return c.json({ error: "unauthorized" }, 401);
    const namespace = c.req.query("namespace");
    if (!namespace) return c.json({ error: "namespace is required" }, 400);
    const limit = c.req.query("limit");
    const entries = await layer.recall({
      namespace,
      key: c.req.query("key"),
      text: c.req.query("q"),
      tag: c.req.query("tag"),
      limit: limit ? Number(limit) : undefined,
    });
    return c.json({ namespace, entries });
  });

  // Retract a fact.
  app.delete("/v1/memory", async (c) => {
    const agent = await authAgent(c);
    if (!agent) return c.json({ error: "unauthorized" }, 401);
    const namespace = c.req.query("namespace");
    const key = c.req.query("key");
    const id = c.req.query("id");
    if (!namespace || (!key && !id)) return c.json({ error: "namespace and key or id required" }, 400);
    const removed = await layer.forget(agent.id, namespace, { key, id });
    return c.json({ removed });
  });

  // Catch up on what other agents have learned.
  app.get("/v1/activity", async (c) => {
    const agent = await authAgent(c);
    if (!agent) return c.json({ error: "unauthorized" }, 401);
    const namespace = c.req.query("namespace");
    if (!namespace) return c.json({ error: "namespace is required" }, 400);
    const since = Number(c.req.query("since") ?? 0);
    const events = await layer.activity(namespace, since);
    const cursor = events.at(-1)?.seq ?? since;
    return c.json({ namespace, cursor, events });
  });

  return { app, layer };
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  createApp()
    .then(({ app }) => {
      serve({ fetch: app.fetch, port }, (info) => console.log(`agent memory listening on :${info.port}`));
    })
    .catch((err) => {
      console.error("failed to start", err);
      process.exit(1);
    });
}
