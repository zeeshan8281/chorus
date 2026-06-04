import type { Store } from "../db/store.js";
import type { MemoryService } from "./memory-service.js";

/**
 * Background sweep: TTL-expired memories are soft-deleted (which appends a
 * signed DELETE commitment to the Merkle tree, so expiry is itself auditable).
 */
export function startExpirationSweep(
  store: Store,
  service: MemoryService,
  intervalMs: number,
  now: () => Date = () => new Date(),
): () => void {
  const tick = async () => {
    try {
      for (const row of await store.getExpired(now())) {
        await service.remove(row.id).catch(() => {});
      }
    } catch {
      /* best-effort */
    }
  };
  const handle = setInterval(tick, intervalMs);
  if (typeof handle.unref === "function") handle.unref();
  return () => clearInterval(handle);
}
