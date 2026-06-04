import { describe, it, expect } from "vitest";
import { canonicalize, contentHash } from "../src/commitment/canonicalize.js";
import { signMemoryOperation, verifyMemorySignature, newPrivateKey, publicKeyFromPrivate, ethAddress } from "../src/commitment/signer.js";

describe("canonicalization", () => {
  it("is order-independent over metadata keys", () => {
    const a = canonicalize("hi", { b: 1, a: 2 });
    const b = canonicalize("hi", { a: 2, b: 1 });
    expect(a.equals(b)).toBe(true);
  });
  it("trims content", () => {
    expect(contentHash("  hi  ").equals(contentHash("hi"))).toBe(true);
  });
});

describe("secp256k1 commitment signatures", () => {
  it("signs and verifies a memory operation", () => {
    const priv = newPrivateKey();
    const pub = publicKeyFromPrivate(priv);
    const ch = contentHash("the user authorized $50/mo");
    const ts = new Date("2026-06-04T12:00:00Z");
    const sig = signMemoryOperation(ch, "billing-agent", ts, "CREATE", priv);
    expect(verifyMemorySignature(ch, "billing-agent", ts, "CREATE", sig, pub)).toBe(true);
  });

  it("rejects a tampered content hash", () => {
    const priv = newPrivateKey();
    const pub = publicKeyFromPrivate(priv);
    const ts = new Date("2026-06-04T12:00:00Z");
    const sig = signMemoryOperation(contentHash("real"), "a", ts, "CREATE", priv);
    expect(verifyMemorySignature(contentHash("fake"), "a", ts, "CREATE", sig, pub)).toBe(false);
  });

  it("derives a 0x ethereum-style address", () => {
    const addr = ethAddress(publicKeyFromPrivate(newPrivateKey()));
    expect(addr).toMatch(/^0x[0-9a-f]{40}$/);
  });
});
