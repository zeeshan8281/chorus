/**
 * End-to-end: create → verifiable read → update (versioned) → search (with
 * set-completeness proof) → soft-delete. Run: npm run demo
 */
import { MemoryService } from "../src/services/memory-service.js";
import { MemStore } from "../src/db/mem-store.js";
import { initializeWallet } from "../src/tee/wallet.js";
import { getAttestation } from "../src/tee/attestation.js";
import { verifyMemory } from "../src/client/verifier.js";

async function main() {
  const wallet = initializeWallet("/tmp/vam-demo");
  const svc = new MemoryService(new MemStore(), wallet);
  const att = getAttestation(wallet);
  console.log(`TEE address: ${att.teeAddress}  (mode: ${att.mode})\n`);

  console.log("=== create ===");
  const m = await svc.create({
    content: "User authorized recurring payment of $50/month to Acme Corp",
    agentId: "billing-agent",
    tags: ["payment", "authorization"],
    metadata: { amount: 50, currency: "USD" },
  });
  console.log(`id=${m.id}  leaf=#${m.commitment.merkleLeafIndex}  root=${m.commitment.merkleRoot.slice(0, 16)}…`);

  console.log("\n=== read + client-side verify ===");
  const read = await svc.get(m.id);
  const v = verifyMemory(read!, read!.teePublicKey);
  console.log(`ok=${v.ok}`, v.checks);

  console.log("\n=== update (new version, re-committed) ===");
  const u = await svc.update(m.id, { content: "User authorized recurring payment of $75/month to Acme Corp", metadata: { amount: 75, currency: "USD" } });
  console.log(`version=${u.version}  newRoot=${u.commitment.merkleRoot.slice(0, 16)}…`);
  const hist = await svc.history(m.id);
  console.log(`history: current v${hist!.current.version}, archived versions ${hist!.versions.map((x) => "v" + x.version).join(", ")}`);

  console.log("\n=== search + set-completeness proof ===");
  await svc.create({ content: "User prefers email receipts", agentId: "billing-agent", tags: ["payment"] });
  const res = await svc.search({ agentId: "billing-agent", tags: ["payment"], limit: 20, offset: 0 });
  console.log(`returned ${res.memories.length} memories, each with a proof; setProof root=${res.setProof.merkleRoot.slice(0, 16)}…`);

  console.log("\n=== soft delete (signed deletion commitment) ===");
  const receipt = await svc.remove(m.id);
  console.log(`deleted ${receipt.memoryId} · op=${receipt.deletionCommitment.operation} · still auditable via history`);
}

main().catch((e) => { console.error(e); process.exit(1); });
