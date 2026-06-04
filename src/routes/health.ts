import { Router, type Request, type Response, type NextFunction } from "express";
import type { MemoryService } from "../services/memory-service.js";

const startedAt = Date.now();

export function healthRouter(svc: MemoryService): Router {
  const r = Router();
  r.get("/", (_req: Request, res: Response, next: NextFunction) => {
    svc.treeRoot()
      .then((root) =>
        res.json({
          status: "healthy",
          treeSize: root.treeSize,
          currentRoot: root.root,
          uptime: Math.floor((Date.now() - startedAt) / 1000),
        }),
      )
      .catch(next);
  });
  return r;
}
