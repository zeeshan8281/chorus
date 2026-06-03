import { describe, it, expect } from "vitest";
import { computeRoot, computeProof, verifyProof, leafHash, EMPTY_ROOT } from "../src/merkle.js";

const leaves = (n: number) => Array.from({ length: n }, (_, i) => leafHash(Buffer.from(`leaf-${i}`).toString("hex")));

describe("merkle tree", () => {
  it("empty tree has the empty root", () => {
    expect(computeRoot([])).toBe(EMPTY_ROOT);
  });

  it("produces a valid inclusion proof for every leaf (odd & even counts)", () => {
    for (const n of [1, 2, 3, 4, 5, 8, 9, 17]) {
      const ls = leaves(n);
      const root = computeRoot(ls);
      for (let i = 0; i < n; i++) {
        const proof = computeProof(ls, i);
        expect(verifyProof(ls[i]!, proof, root)).toBe(true);
      }
    }
  });

  it("rejects a proof for the wrong leaf", () => {
    const ls = leaves(6);
    const root = computeRoot(ls);
    const proof = computeProof(ls, 2);
    expect(verifyProof(ls[3]!, proof, root)).toBe(false);
  });

  it("changing any leaf changes the root (tamper-evidence)", () => {
    const ls = leaves(7);
    const root = computeRoot(ls);
    const tampered = ls.slice();
    tampered[4] = leafHash(Buffer.from("evil").toString("hex"));
    expect(computeRoot(tampered)).not.toBe(root);
  });
});
