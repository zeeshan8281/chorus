import { Router, type Request, type Response, type NextFunction } from "express";
import type { MemoryService } from "../services/memory-service.js";

const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export function treeRouter(svc: MemoryService): Router {
  const r = Router();
  r.get("/root", wrap(async (_req, res) => {
    res.json({ ...(await svc.treeRoot()), teePublicKey: svc.publicKeyHex() });
  }));
  r.get("/proof/:leafIndex", wrap(async (req, res) => {
    const idx = Number(req.params.leafIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      res.status(400).json({ error: "leafIndex must be a non-negative integer" });
      return;
    }
    try {
      res.json(await svc.proofForLeaf(idx));
    } catch {
      res.status(404).json({ error: "leaf not found" });
    }
  }));
  return r;
}
