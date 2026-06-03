import { describe, it, expect } from "vitest";
import { MemoryLayer } from "../src/memory.js";
import { InMemoryStore } from "../src/store/memory.js";

function fixedClock(start = "2026-06-03T00:00:00.000Z") {
  let t = new Date(start).getTime();
  return () => new Date((t += 1000));
}
function layer() {
  return new MemoryLayer({ store: new InMemoryStore(), now: fixedClock() });
}

describe("shared memory: write & recall", () => {
  it("remembers a free-form fact and recalls it", async () => {
    const m = layer();
    const a = await m.registerAgent("researcher");
    await m.remember(a.id, { namespace: "team:acme", content: "user prefers dark mode" });
    const out = await m.recall({ namespace: "team:acme" });
    expect(out).toHaveLength(1);
    expect(out[0]?.content).toBe("user prefers dark mode");
    expect(out[0]?.contributors).toEqual([a.id]);
  });

  it("isolates namespaces", async () => {
    const m = layer();
    const a = await m.registerAgent("a");
    await m.remember(a.id, { namespace: "team:acme", content: "acme thing" });
    await m.remember(a.id, { namespace: "team:globex", content: "globex thing" });
    const acme = await m.recall({ namespace: "team:acme" });
    expect(acme.map((e) => e.content)).toEqual(["acme thing"]);
  });
});

describe("coordination: upsert by key", () => {
  it("updates a shared fact in place instead of duplicating", async () => {
    const m = layer();
    const a1 = await m.registerAgent("agent-1");
    const a2 = await m.registerAgent("agent-2");
    const first = await m.remember(a1.id, { namespace: "n", key: "deploy.target", content: "staging" });
    expect(first.updated).toBe(false);

    const second = await m.remember(a2.id, { namespace: "n", key: "deploy.target", content: "production" });
    expect(second.updated).toBe(true);
    expect(second.previousContent).toBe("staging");
    expect(second.entry.revision).toBe(2);
    expect(second.entry.content).toBe("production");
    expect(second.entry.contributors).toEqual([a1.id, a2.id]); // both tracked

    const all = await m.recall({ namespace: "n", key: "deploy.target" });
    expect(all).toHaveLength(1); // one shared fact, not two
  });

  it("does not double-count a repeat contributor", async () => {
    const m = layer();
    const a = await m.registerAgent("a");
    await m.remember(a.id, { namespace: "n", key: "k", content: "v1" });
    const r = await m.remember(a.id, { namespace: "n", key: "k", content: "v2" });
    expect(r.entry.contributors).toEqual([a.id]);
  });
});

describe("coordination: activity feed", () => {
  it("lets an agent catch up on what others learned since a cursor", async () => {
    const m = layer();
    const a1 = await m.registerAgent("a1");
    const a2 = await m.registerAgent("a2");

    await m.remember(a1.id, { namespace: "n", key: "x", content: "1" });
    const seen = (await m.activity("n")).at(-1)?.seq ?? 0;

    await m.remember(a2.id, { namespace: "n", key: "y", content: "2" });
    await m.remember(a2.id, { namespace: "n", key: "x", content: "1b" });

    const fresh = await m.activity("n", seen);
    expect(fresh).toHaveLength(2);
    expect(fresh.map((e) => e.type)).toEqual(["remember", "update"]);
    expect(fresh.every((e) => e.agentId === a2.id)).toBe(true);
  });

  it("scopes activity to a namespace", async () => {
    const m = layer();
    const a = await m.registerAgent("a");
    await m.remember(a.id, { namespace: "n1", content: "x" });
    await m.remember(a.id, { namespace: "n2", content: "y" });
    expect(await m.activity("n1")).toHaveLength(1);
  });
});

describe("forget", () => {
  it("retracts a fact by key", async () => {
    const m = layer();
    const a = await m.registerAgent("a");
    await m.remember(a.id, { namespace: "n", key: "k", content: "v" });
    expect(await m.forget(a.id, "n", { key: "k" })).toBe(true);
    expect(await m.get("n", "k")).toBeUndefined();
    expect((await m.activity("n")).at(-1)?.type).toBe("forget");
  });
});
