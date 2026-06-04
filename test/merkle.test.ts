import { describe, it, expect } from "vitest";
import { computeRoot, computeProof, verifyProof, computeLeafHash, EMPTY_HASH } from "../src/merkle/tree.js";
import { sha256 } from "../src/commitment/hasher.js";

const leaves = (n: number) => Array.from({ length: n }, (_, i) => sha256(`leaf-${i}`));

describe("merkle tree", () => {
  it("empty tree → EMPTY_HASH", () => {
    expect(computeRoot([]).equals(EMPTY_HASH)).toBe(true);
  });

  it("valid inclusion proof for every leaf across sizes", () => {
    for (const n of [1, 2, 3, 5, 8, 9, 16, 17, 31]) {
      const ls = leaves(n);
      for (let i = 0; i < n; i++) {
        expect(verifyProof(computeProof(ls, i))).toBe(true);
      }
    }
  });

  it("proof for one leaf does not verify another", () => {
    const ls = leaves(6);
    const p = computeProof(ls, 2);
    p.leafHash = ls[3]!.toString("hex");
    expect(verifyProof(p)).toBe(false);
  });

  it("changing a leaf changes the root", () => {
    const ls = leaves(7);
    const root = computeRoot(ls).toString("hex");
    ls[3] = sha256("tampered");
    expect(computeRoot(ls).toString("hex")).not.toBe(root);
  });

  it("leaf hash binds contentHash + id + timestamp", () => {
    const ch = sha256("content");
    const ts = new Date("2026-06-04T00:00:00Z");
    expect(computeLeafHash(ch, "id-1", ts).equals(computeLeafHash(ch, "id-1", ts))).toBe(true);
    expect(computeLeafHash(ch, "id-1", ts).equals(computeLeafHash(ch, "id-2", ts))).toBe(false);
  });
});
