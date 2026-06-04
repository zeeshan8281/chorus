/**
 * Tamper detection: write a memory, then have the "operator" edit the stored
 * content directly — verification fails because it no longer hashes to its
 * committed Merkle leaf. Run: npm run demo:tamper
 */
import { MemoryService } from "../src/services/memory-service.js";
import { MemStore } from "../src/db/mem-store.js";
import { initializeWallet } from "../src/tee/wallet.js";
import { verifyMemory } from "../src/client/verifier.js";

async function main() {
  const store = new MemStore();
  const svc = new MemoryService(store, initializeWallet("/tmp/vam-demo-tamper"));

  const m = await svc.create({ content: "User spending limit is $1,000", agentId: "agent-x" });
  console.log("written:", m.content);
  const before = verifyMemory((await svc.get(m.id))!, m.commitment ? undefined : undefined);
  console.log("verify (clean):", before.ok, before.checks);

  // operator reaches into the DB and rewrites the content
  const row = await store.getMemory(m.id);
  (row as any).content = "User spending limit is $1,000,000";
  await store.updateMemory(row!);
  console.log("\noperator changed stored content to:", (await store.getMemory(m.id))!.content);

  const after = await svc.get(m.id);
  const v = verifyMemory(after!, after!.teePublicKey);
  console.log("verify (tampered):", v.ok);
  console.log("checks:", v.checks);
  console.log("reasons:", v.reasons.join(" | "));
}

main().catch((e) => { console.error(e); process.exit(1); });
