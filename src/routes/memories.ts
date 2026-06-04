import { Router, type Request, type Response, type NextFunction } from "express";
import { MemoryService, NotFoundError } from "../services/memory-service.js";
import type { SearchFilter } from "../types.js";

const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export function memoriesRouter(svc: MemoryService): Router {
  const r = Router();

  r.post("/", wrap(async (req, res) => {
    const { content, agentId, metadata, tags, ttlSeconds } = req.body ?? {};
    if (!content || !agentId) {
      res.status(400).json({ error: "content and agentId are required" });
      return;
    }
    res.status(201).json(await svc.create({ content, agentId, metadata, tags, ttlSeconds }));
  }));

  // search MUST be declared before "/:id"
  r.get("/", wrap(async (req, res) => {
    const agentId = req.query.agentId as string | undefined;
    if (!agentId) {
      res.status(400).json({ error: "agentId query param is required" });
      return;
    }
    const filter: SearchFilter = {
      agentId,
      tags: req.query.tags ? String(req.query.tags).split(",").filter(Boolean) : undefined,
      since: req.query.since ? new Date(String(req.query.since)) : undefined,
      until: req.query.until ? new Date(String(req.query.until)) : undefined,
      limit: Math.min(Number(req.query.limit ?? 20), 100),
      offset: Number(req.query.offset ?? 0),
    };
    res.json(await svc.search(filter));
  }));

  r.get("/:id", wrap(async (req, res) => {
    const result = await svc.get(req.params.id!);
    if (!result) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(result);
  }));

  r.get("/:id/history", wrap(async (req, res) => {
    const h = await svc.history(req.params.id!);
    if (!h) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({
      memoryId: req.params.id!,
      currentVersion: h.current.version,
      current: h.current,
      versions: h.versions,
      teePublicKey: svc.publicKeyHex(),
    });
  }));

  r.put("/:id", wrap(async (req, res) => {
    const { content, metadata, tags } = req.body ?? {};
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    try {
      res.json(await svc.update(req.params.id!, { content, metadata, tags }));
    } catch (e) {
      if (e instanceof NotFoundError) { res.status(404).json({ error: "not found" }); return; }
      throw e;
    }
  }));

  r.delete("/:id", wrap(async (req, res) => {
    try {
      res.json(await svc.remove(req.params.id!));
    } catch (e) {
      if (e instanceof NotFoundError) { res.status(404).json({ error: "not found" }); return; }
      throw e;
    }
  }));

  return r;
}
