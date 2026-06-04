import express from "express";
import { loadConfig } from "./config.js";
import { MemStore } from "./db/mem-store.js";
import { initializeWallet } from "./tee/wallet.js";
import { getAttestation } from "./tee/attestation.js";
import { MemoryService } from "./services/memory-service.js";
import { startExpirationSweep } from "./services/expiration-service.js";
import { memoriesRouter } from "./routes/memories.js";
import { treeRouter } from "./routes/tree.js";
import { attestationRouter } from "./routes/attestation.js";
import { healthRouter } from "./routes/health.js";
import type { Store } from "./db/store.js";

export async function createApp() {
  const config = loadConfig();
  let store: Store;
  if (config.databaseUrl) {
    const { PgStore } = await import("./db/pg-store.js");
    store = await PgStore.connect(config.databaseUrl);
  } else {
    store = new MemStore();
    await store.init();
  }

  const wallet = initializeWallet(config.dataDir);
  const service = new MemoryService(store, wallet);
  const stopSweep = startExpirationSweep(store, service, config.expirySweepMs);

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.use("/v1/memories", memoriesRouter(service));
  app.use("/v1/tree", treeRouter(service));
  app.use("/v1/attestation", attestationRouter(wallet));
  app.use("/v1/health", healthRouter(service));

  // error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });

  return { app, service, store, wallet, config, stopSweep };
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  createApp()
    .then(({ app, config, wallet }) => {
      app.listen(config.port, () => {
        const att = getAttestation(wallet);
        console.log(`verifiable-agent-memory listening on :${config.port}`);
        console.log(`  attestation mode: ${att.mode} · TEE address: ${att.teeAddress}`);
        if (att.mode === "dev") console.log("  ⚠ dev mode — not running in a TEE; clients will not trust this in production");
      });
    })
    .catch((err) => {
      console.error("failed to start", err);
      process.exit(1);
    });
}
