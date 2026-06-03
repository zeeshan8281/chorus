// Browser port of the core verifiable-memory primitives. Uses the Web Crypto
// API to compute REAL SHA-256 Merkle roots and inclusion proofs — the same
// scheme the server uses — so the live demo isn't a mockup.

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  // copy into a fresh ArrayBuffer-backed view to satisfy strict BufferSource typing
  const buf = await crypto.subtle.digest("SHA-256", bytes.slice());
  return bytesToHex(new Uint8Array(buf));
}
export async function sha256Hex(text: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(text));
}

function canonical(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.keys(v as object)
            .sort()
            .reduce<Record<string, unknown>>((o, k) => ((o[k] = sort((v as Record<string, unknown>)[k])), o), {})
        : v;
  return JSON.stringify(sort(value));
}

const LEAF = new Uint8Array([0x00]);
const NODE = new Uint8Array([0x01]);

/** leaf = sha256(0x00 ‖ leafPayload) — domain-separated from internal nodes. */
async function leafHash(payloadHex: string): Promise<string> {
  return sha256Bytes(concat(LEAF, hexToBytes(payloadHex)));
}
async function hashPair(l: string, r: string): Promise<string> {
  return sha256Bytes(concat(NODE, hexToBytes(l), hexToBytes(r)));
}

export interface EntryCore {
  id: string;
  content: string;
  index: number;
}

/** Recompute an entry's committed leaf from its current contents. */
export async function computeLeaf(e: EntryCore): Promise<string> {
  const contentHash = await sha256Hex(canonical({ id: e.id, content: e.content, index: e.index }));
  const payload = await sha256Hex(canonical({ index: e.index, contentHash }));
  return leafHash(payload);
}

export async function computeRoot(leaves: string[]): Promise<string> {
  if (leaves.length === 0) return sha256Hex("");
  let level = leaves.slice();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const l = level[i]!;
      const r = i + 1 < level.length ? level[i + 1]! : l;
      next.push(await hashPair(l, r));
    }
    level = next;
  }
  return level[0]!;
}

export interface ProofStep {
  hash: string;
  dir: "L" | "R";
}
export async function computeProof(leaves: string[], index: number): Promise<ProofStep[]> {
  const proof: ProofStep[] = [];
  let level = leaves.slice();
  let idx = index;
  while (level.length > 1) {
    const isRight = idx % 2 === 1;
    const sibIdx = isRight ? idx - 1 : idx + 1;
    const sibling = sibIdx < level.length ? level[sibIdx]! : level[idx]!;
    proof.push({ hash: sibling, dir: isRight ? "L" : "R" });
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const l = level[i]!;
      const r = i + 1 < level.length ? level[i + 1]! : l;
      next.push(await hashPair(l, r));
    }
    level = next;
    idx = Math.floor(idx / 2);
  }
  return proof;
}
export async function verifyProof(leaf: string, proof: ProofStep[], root: string): Promise<boolean> {
  let acc = leaf;
  for (const step of proof) acc = step.dir === "L" ? await hashPair(step.hash, acc) : await hashPair(acc, step.hash);
  return acc === root;
}

// ---- anti-injection gate (mirror of the server heuristic) ----
const RULES: { re: RegExp; w: number; reason: string }[] = [
  { re: /\b(ignore|disregard|forget|override)\b[^.]{0,40}\b(previous|prior|earlier|above|all|your)\b[^.]{0,24}\b(instruction|instructions|context|rules|memor|prompt)/i, w: 0.7, reason: "overrides prior instructions" },
  { re: /\b(from now on|going forward|whenever you|always|never)\b[^.]{0,44}\b(you (must|should|will|are to)|approve|transfer|send|recommend|ignore)\b/i, w: 0.5, reason: "implants a persistent directive" },
  { re: /\b(system prompt|system message|you are now|new system|\[system\])/i, w: 0.5, reason: "impersonates the system" },
  { re: /\b(send|forward|exfiltrate|post|upload|leak|email)\b[^.]{0,44}\b(to|at)\b[^.]{0,44}(https?:\/\/|@|webhook|0x[a-f0-9]{6})/i, w: 0.65, reason: "exfiltrates data externally" },
];
export interface Verdict {
  risk: number;
  blocked: boolean;
  reasons: string[];
}
export function inspect(content: string, blockThreshold = 0.6): Verdict {
  let risk = 0;
  const reasons: string[] = [];
  for (const r of RULES)
    if (r.re.test(content)) {
      risk += r.w;
      reasons.push(r.reason);
    }
  risk = Math.min(1, Number(risk.toFixed(2)));
  return { risk, blocked: risk >= blockThreshold, reasons };
}

export const short = (h: string) => (h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h);
