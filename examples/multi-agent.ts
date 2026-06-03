/**
 * Shared memory across a team of agents.
 *
 *   - A researcher and an analyst write facts into one shared namespace.
 *   - The analyst learns something newer and UPDATES a shared fact by key —
 *     no duplicate, and both agents are tracked as contributors.
 *   - An executor that's been away catches up using the activity feed,
 *     reading only what changed since it last looked.
 *
 * Run: npm run example
 */
import { MemoryLayer } from "../src/index.js";

const NS = "team:trading-desk";

async function main() {
  const mem = new MemoryLayer();
  const researcher = await mem.registerAgent("researcher");
  const analyst = await mem.registerAgent("analyst");
  const executor = await mem.registerAgent("executor");

  console.log("=== agents write to shared memory ===");
  await mem.remember(researcher.id, { namespace: NS, key: "risk.policy", content: "Max position size per trade is 2%." });
  await mem.remember(researcher.id, { namespace: NS, key: "market.session", content: "US session open 09:30 ET." });

  // executor takes a snapshot of how far it has caught up
  let cursor = (await mem.activity(NS)).at(-1)?.seq ?? 0;

  console.log("\n=== analyst updates a shared fact (coordination) ===");
  const upd = await mem.remember(analyst.id, { namespace: NS, key: "risk.policy", content: "Max position size per trade is 1.5% (tightened)." });
  console.log(`updated=${upd.updated} rev=${upd.entry.revision}`);
  console.log(`  was: ${upd.previousContent}`);
  console.log(`  now: ${upd.entry.content}`);
  console.log(`  contributors: ${upd.entry.contributors.length} agents`);

  await mem.remember(analyst.id, { namespace: NS, key: "vendor.sla", content: "Data vendor SLA 99.9%, 4h response." });

  console.log("\n=== current shared memory ===");
  for (const e of await mem.recall({ namespace: NS })) {
    console.log(`  • [${e.key}] ${e.content}  (rev ${e.revision}, ${e.contributors.length} contrib)`);
  }

  console.log("\n=== executor catches up on what it missed ===");
  const fresh = await mem.activity(NS, cursor);
  console.log(`${fresh.length} new events since the executor last looked:`);
  for (const ev of fresh) {
    const entry = await mem.get(NS, ev.key!);
    console.log(`  #${ev.seq} ${ev.type.padEnd(8)} ${ev.key} → ${entry?.content ?? "(forgotten)"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
