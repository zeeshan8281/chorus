import {
  createHash,
  generateKeyPairSync,
  sign as edSign,
  verify as edVerify,
  createPublicKey,
  createPrivateKey,
  randomBytes,
  type KeyObject,
} from "node:crypto";

/** Deterministic JSON: keys sorted recursively so hashes/signatures are stable. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}
function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) o[k] = sortDeep((v as Record<string, unknown>)[k]);
    return o;
  }
  return v;
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
export function hashObject(value: unknown): string {
  return sha256Hex(canonicalize(value));
}

export interface KeyPair {
  publicKey: string; // base64 SPKI
  privateKey: string; // base64 PKCS8
}

export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
  };
}

function pub(b64: string): KeyObject {
  return createPublicKey({ key: Buffer.from(b64, "base64"), type: "spki", format: "der" });
}
function priv(b64: string): KeyObject {
  return createPrivateKey({ key: Buffer.from(b64, "base64"), type: "pkcs8", format: "der" });
}

export function sign(message: string, privateKeyB64: string): string {
  return edSign(null, Buffer.from(message, "utf8"), priv(privateKeyB64)).toString("base64");
}
export function verify(message: string, signatureB64: string, publicKeyB64: string): boolean {
  try {
    return edVerify(null, Buffer.from(message, "utf8"), pub(publicKeyB64), Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("hex")}`;
}
export function generateApiKey(): string {
  return `vmk_${randomBytes(24).toString("base64url")}`;
}
