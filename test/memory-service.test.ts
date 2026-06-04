import { describe, it, expect } from "vitest";
import { MemoryService } from "../src/services/memory-service.js";
import { MemStore } from "../src/db/mem-store.js";
import { initializeWallet } from "../src/tee/wallet.js";
import { verifyMemory } from "../src/client/verifier.js";
import { fromHex } from "../src/commitment/hasher.js";
import { verifyBytes } from "../src/commitment/signer.js";

function fixedClock(start = "2026-06-04T00:00:00.000Z") {
  let t = new Date(start).getTime();
  return () => new Date((t += 1000));
}
function svc() {
  const wallet = initializeWallet("/tmp/vam-test-" + Math.floor(Math.random() * 1e9));
  return { service: new MemoryService(new MemStore(), wallet, fixedClock()), wallet };
}

describe("create + verifiable read", () => {
  it("a client can fully verify a freshly written memory", async () => {
    const { service, wallet } = svc();
    const mem = await service.create({ content: "User prefers dark mode", agentId: "agent-1", tags: ["pref"] });
    const read = await service.get(mem.id);
    expect(read).toBeDefined();
    const result = verifyMemory(read!, read!.teePublicKey);
    expect(result.ok).toBe(true);
    expect(result.checks).toMatchObject({ contentHash: true, signature: true, leafBinding: true, inclusion: true, rootMatch: true });
    expect(read!.teePublicKey.toLowerCase()).toBe(wallet.publicKey.toString("hex"));
  });

  it("detects operator content tampering", async () => {
    const store = new MemStore();
    const wallet = initializeWallet("/tmp/vam-test-t");
    const service = new MemoryService(store, wallet, fixedClock());
    const mem = await service.create({ content: "transfer $100", agentId: "a" });
    // operator edits stored content directly
    const row = await store.getMemory(mem.id);
    (row as any).content = "transfer $1000000";
    await store.updateMemory(row!);
    const read = await service.get(mem.id);
    const result = verifyMemory(read!, read!.teePublicKey);
    expect(result.ok).toBe(false);
    expect(result.checks.contentHash).toBe(false);
  });

  it("rejects an injected memory not signed by the TEE key", async () => {
    const { service } = svc();
    const real = await service.create({ content: "real", agentId: "a" });
    const read = await service.get(real.id);
    // verify against a DIFFERENT (attacker) key → must fail
    const attackerKey = "04" + "ab".repeat(32);
    const result = verifyMemory(read!, attackerKey);
    expect(result.ok).toBe(false);
    expect(result.checks.teeKey).toBe(false);
  });
});

describe("update + versioning", () => {
  it("archives the prior version and re-commits", async () => {
    const { service } = svc();
    const mem = await service.create({ content: "v1 content", agentId: "a" });
    const upd = await service.update(mem.id, { content: "v2 content" });
    expect(upd.version).toBe(2);
    const hist = await service.history(mem.id);
    expect(hist!.current.version).toBe(2);
    expect(hist!.versions.map((v) => v.version)).toEqual([1]);
    const read = await service.get(mem.id);
    expect(verifyMemory(read!, read!.teePublicKey).ok).toBe(true);
  });
});

describe("soft delete", () => {
  it("produces a signed deletion receipt and hides the memory", async () => {
    const { service } = svc();
    const mem = await service.create({ content: "secret", agentId: "a" });
    const receipt = await service.remove(mem.id);
    expect(receipt.deletionCommitment.operation).toBe("DELETE");
    expect(await service.get(mem.id)).toBeUndefined(); // hidden
    expect((await service.history(mem.id))!.current.isDeleted).toBe(true); // still auditable
  });
});

describe("search + set-completeness proof", () => {
  it("returns proofs and a TEE-signed set proof", async () => {
    const { service, wallet } = svc();
    for (let i = 0; i < 3; i++) await service.create({ content: `m${i}`, agentId: "a", tags: ["x"] });
    await service.create({ content: "other", agentId: "b" });
    const res = await service.search({ agentId: "a", limit: 20, offset: 0 });
    expect(res.memories).toHaveLength(3);
    expect(res.proofs).toHaveLength(3);
    // set proof signature verifies under the TEE key
    const msg = Buffer.concat([fromHex(res.setProof.queryHash), fromHex(res.setProof.resultSetHash), fromHex(res.setProof.merkleRoot)]);
    expect(verifyBytes(msg, fromHex(res.setProof.signature), wallet.publicKey)).toBe(true);
  });
});
