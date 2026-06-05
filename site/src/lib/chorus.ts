// Real client for the live Chorus / verifiable-memory TEE backend.
//
// Every primitive here byte-for-byte mirrors the server (src/commitment/*,
// src/merkle/tree.ts, src/client/verifier.ts) so a memory read can be verified
// in the browser with ZERO trust in the server or this proxy:
//
//   contentHash   = sha256(JSON({content: content.trim(), metadata: sortedKeys}))
//   opDigest      = sha256(contentHash ‖ agentId ‖ int64be(tsMs) ‖ operation)
//   signature     = secp256k1(opDigest)            ← signed by the enclave key
//   leaf          = sha256(contentHash ‖ memoryId ‖ int64be(tsMs))
//   internal node = sha256(left ‖ right)
//   root signature= secp256k1(sha256(root ‖ int64be(treeSize)))
//
// API is reached same-origin at /v1/* — the Vercel rewrite proxies to the
// HTTP-only TEE, so the browser never sees mixed content.

import { sha256 as nobleSha256 } from "@noble/hashes/sha256";
import { secp256k1 } from "@noble/curves/secp256k1";

const enc = new TextEncoder();

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
export function bytesToHex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function int64be(ms: number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigInt64(0, BigInt(ms), false);
  return b;
}
const sha256 = (b: Uint8Array): Uint8Array => nobleSha256(b);

function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) o[k] = sortKeysDeep((v as Record<string, unknown>)[k]);
    return o;
  }
  return v;
}
function contentHashBytes(content: string, metadata: Record<string, unknown> = {}): Uint8Array {
  const canonical = JSON.stringify({ content: content.trim(), metadata: sortKeysDeep(metadata) });
  return sha256(enc.encode(canonical));
}
function operationDigest(cHash: Uint8Array, agentId: string, tsMs: number, op: string): Uint8Array {
  return sha256(concat(cHash, enc.encode(agentId), int64be(tsMs), enc.encode(op)));
}
function leafHashHex(cHash: Uint8Array, memoryId: string, tsMs: number): string {
  return bytesToHex(sha256(concat(cHash, enc.encode(memoryId), int64be(tsMs))));
}
function pair(l: Uint8Array, r: Uint8Array): Uint8Array {
  return sha256(concat(l, r));
}

// ---------- wire types (subset of server's types.ts) ----------
export interface Commitment {
  contentHash: string; signature: string; merkleRoot: string;
  merkleLeafIndex: number; operation: string; timestamp: string;
}
export interface Memory {
  id: string; agentId: string; content: string; metadata: Record<string, unknown>;
  version: number; createdAt: string; updatedAt: string; commitment: Commitment;
}
export interface ProofStep { hash: string; position: "left" | "right"; }
export interface MerkleProof { leafIndex: number; leafHash: string; siblings: ProofStep[]; root: string; treeSize: number; }
export interface MemoryWithProof { memory: Memory; proof: MerkleProof; teePublicKey: string; }
export interface SignedRoot { root: string; treeSize: number; signature: string; timestamp: string; teePublicKey: string; }
export interface Attestation {
  mode: "tee" | "dev"; teePublicKey: string; teeAddress: string;
  imageDigest: string | null; kmsKeyFingerprint: string | null;
  platform: string; confidentialSpace: string; verifyUrl: string;
}

// ---------- API (same-origin proxy → TEE) ----------
const BASE = "/v1";
async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}
export const api = {
  write: (agentId: string, content: string) =>
    fetch(`${BASE}/memories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId, content }),
    }).then(j<Memory>),
  read: (id: string) => fetch(`${BASE}/memories/${id}`).then(j<MemoryWithProof>),
  root: () => fetch(`${BASE}/tree/root`).then(j<SignedRoot>),
  attestation: () => fetch(`${BASE}/attestation`).then(j<Attestation>),
};

// ---------- verification (mirrors src/client/verifier.ts) ----------
export interface VerifyChecks {
  contentHash: boolean; signature: boolean; leafBinding: boolean; inclusion: boolean; rootMatch: boolean;
}
export interface VerifyResult { ok: boolean; checks: VerifyChecks; reasons: string[]; }

/** Verify a real proof against the enclave signature. Pass `contentOverride` to
 *  simulate tampering: we keep the server's signed commitment/proof but hash the
 *  (mutated) local content — every content-bound check then correctly FAILS.
 *
 *  `signedRoot` is the CURRENT enclave-signed root: the log is append-only, so a
 *  leaf's proof is generated against the live tree (which has grown past the
 *  root recorded in its commitment). The meaningful binding is therefore
 *  "proof reconstructs the current signed root", not "proof root == commitment
 *  root" (which only holds for the most recently written leaf). */
export function verifyMemory(resp: MemoryWithProof, signedRoot: SignedRoot, contentOverride?: string): VerifyResult {
  const { memory, proof, teePublicKey } = resp;
  const c = memory.commitment;
  const reasons: string[] = [];
  const content = contentOverride ?? memory.content;
  const tsMs = new Date(c.timestamp).getTime();

  const cHash = contentHashBytes(content, memory.metadata);
  const contentHash = bytesToHex(cHash) === c.contentHash;
  if (!contentHash) reasons.push("contentHash: content no longer hashes to the committed hash — tampered");

  let signature = false;
  try {
    signature = secp256k1.verify(hexToBytes(c.signature), operationDigest(cHash, memory.agentId, tsMs, c.operation), hexToBytes(teePublicKey));
  } catch { signature = false; }
  if (!signature) reasons.push("signature: enclave secp256k1 signature does not cover this content");

  const leafBinding = leafHashHex(cHash, memory.id, tsMs) === proof.leafHash;
  if (!leafBinding) reasons.push("leafBinding: entry does not match its committed Merkle leaf");

  const inclusion = verifyProof(proof);
  if (!inclusion) reasons.push("inclusion: Merkle proof does not reconstruct the signed root");

  const rootMatch = proof.root === signedRoot.root;
  if (!rootMatch) reasons.push("rootMatch: proof root is not the current enclave-signed root");

  return {
    ok: contentHash && signature && leafBinding && inclusion && rootMatch,
    checks: { contentHash, signature, leafBinding, inclusion, rootMatch },
    reasons,
  };
}

/** Stateless Merkle inclusion check — recomputes the root from leaf + siblings. */
export function verifyProof(proof: MerkleProof): boolean {
  let acc = hexToBytes(proof.leafHash);
  for (const s of proof.siblings) {
    const sib = hexToBytes(s.hash);
    acc = s.position === "left" ? pair(sib, acc) : pair(acc, sib);
  }
  return bytesToHex(acc) === proof.root;
}

/** Verify the enclave's signature over the current Merkle root. */
export function verifyRootSignature(r: SignedRoot): boolean {
  try {
    const msg = sha256(concat(hexToBytes(r.root), int64be(r.treeSize)));
    return secp256k1.verify(hexToBytes(r.signature), msg, hexToBytes(r.teePublicKey));
  } catch {
    return false;
  }
}

export const short = (h: string): string => (h && h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h);

// Client-side write-time guardrail (NOT a TEE claim) — flags prompt-injection
// content before it is ever sent to the log.
const RULES: { re: RegExp; w: number; reason: string }[] = [
  { re: /\b(ignore|disregard|forget|override)\b[^.]{0,40}\b(previous|prior|earlier|above|all|your)\b[^.]{0,24}\b(instruction|instructions|context|rules|memor|prompt)/i, w: 0.7, reason: "overrides prior instructions" },
  { re: /\b(from now on|going forward|whenever you|always|never)\b[^.]{0,44}\b(you (must|should|will|are to)|approve|transfer|send|recommend|ignore)\b/i, w: 0.5, reason: "implants a persistent directive" },
  { re: /\b(send|forward|exfiltrate|post|upload|leak|email)\b[^.]{0,44}\b(to|at)\b[^.]{0,44}(https?:\/\/|@|webhook|0x[a-f0-9]{6})/i, w: 0.65, reason: "exfiltrates data externally" },
];
export interface Verdict { risk: number; blocked: boolean; reasons: string[]; }
export function inspect(content: string, blockThreshold = 0.6): Verdict {
  let risk = 0;
  const reasons: string[] = [];
  for (const r of RULES) if (r.re.test(content)) { risk += r.w; reasons.push(r.reason); }
  risk = Math.min(1, Number(risk.toFixed(2)));
  return { risk, blocked: risk >= blockThreshold, reasons };
}
