import { Router } from "express";
import type { TeeWallet } from "../tee/wallet.js";
import { getAttestation } from "../tee/attestation.js";

export function attestationRouter(wallet: TeeWallet): Router {
  const r = Router();
  r.get("/", (_req, res) => res.json(getAttestation(wallet)));
  return r;
}
