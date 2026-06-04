# Product Spec — Verifiable Agent Memory

**Status:** v0.1 implemented (library + HTTP service + landing page); EigenCompute deploy pending
**Owner:** zeeshan8281
**Series:** Observability Series, Part 3 (EigenLabs)
**Repo:** github.com/zeeshan8281/chorus · package `verifiable-agent-memory`

---

## 1. One-liner

A drop-in, Mem0-compatible memory layer for AI agents where **every memory is cryptographically committed and every read is provable** — running inside an Intel TDX TEE on EigenCompute so even the host operator can't inject, edit, delete, or replay what an agent remembers.

## 2. Problem

Agent memory is the highest-leverage attack surface in autonomous systems: **if you control what an agent remembers, you control what it does.** Today's memory layers (vector DBs, Mem0-style stores) are opaque databases owned by whoever runs the infra. They offer no defense against four operator-level attacks:

- **Injection** — fabricated memories ("the user authorized a $50k transfer") steer behavior.
- **Tampering** — stored memories are edited after the fact.
- **Deletion** — inconvenient memories quietly disappear.
- **Replay** — stale state is re-served to re-trigger actions.

When agents move money or act unsupervised, "trust me, the database is fine" is not acceptable. There is no way today to *prove* to a third party that a memory is authentic, unmodified, and complete.

## 3. Target users

| Segment | Need | Why us |
| --- | --- | --- |
| **Agent developers on EigenCompute** | drop-in memory with commitments baked in | feels like Mem0, adds proofs for free |
| **Protocol / DeFi agent teams** | prove the agent's memory wasn't tampered with | on-chain attestation + per-memory proofs |
| **Auditors / counterparties** | independently verify a memory existed, unmodified, written by attested code | stateless client `verifyMemory()` |
| **Multi-agent system builders** | Agent A's writes verifiable before Agent B reads | shared, signed, append-only memory |

Primary beachhead: **EigenCompute agent builders** who already value verifiability and can deploy into the TEE with one command.

## 4. Value proposition

> Recall is a commodity. **Trust is the product.** Mem0 makes your agent *remember*; this makes it *prove what it remembers* — to itself, to a counterparty, and to a regulator.

## 5. Goals / Non-goals

**Goals**
1. Tamper-evident store — every write yields a SHA-256 hash + secp256k1 signature + Merkle-root update.
2. Provable reads — every read returns a Merkle inclusion proof; search returns a set-completeness proof.
3. TEE-sealed signing key — generated/sealed to the attested image; only attested code can sign.
4. Mem0-compatible REST API — minimal-change adoption.
5. On-chain attestation — verifiers confirm the exact running code.
6. Demoable by one dev in a week.

**Non-goals (v1):** distributed/replicated memory, vector/semantic search, multi-tenant isolation beyond `agentId`, production HA/DR, EigenDA anchoring of full contents.

## 6. Core capabilities (and build status)

| Capability | What it does | Status |
| --- | --- | --- |
| Hash + sign every write | canonicalize → SHA-256 → secp256k1 (TEE wallet, 0x address) | ✅ built |
| Append-only Merkle tree | per-write leaf, signed root, inclusion proofs | ✅ built |
| Client-side `verifyMemory()` | 5 checks: tee-key, signature, leaf-binding, inclusion, root-match | ✅ built |
| Mem0-compatible API | add / get / search / update / delete / history | ✅ built |
| Versioning | updates archive prior versions, re-commit | ✅ built |
| Signed soft-delete + TTL | deletions/expiry append signed DELETE commitments | ✅ built |
| Set-completeness proof | search can't silently omit results | ✅ built |
| Commitment log | append-only audit trail of every operation | ✅ built |
| PostgreSQL (PRD schema) | memories / merkle_nodes / commitment_log / memory_versions | ✅ built |
| TDX attestation endpoint | image digest + KMS fingerprint + TEE key | ✅ built |
| OTel spans | Part 1 (Trace Mirror) integration hook | ✅ hook |
| EigenCompute deployment | Docker (Node 20 + PG16) via `ecloud` | ⏳ pending |
| Client SDK | `VerifiableMemoryClient` + verifier | ✅ built |
| Landing page | eigen-design system (Tailwind v4 + shadcn + ABC Repro) | ✅ built |

## 7. Surface / UX

**Library**
```ts
const m = await svc.create({ content, agentId, tags });
const read = await svc.get(m.id);                 // memory + proof + attestation
verifyMemory(read, read.teePublicKey).ok;         // true
```

**HTTP (Mem0-shaped):** `POST/GET/PUT/DELETE /v1/memories`, `GET /v1/memories?…` (search + set-proof), `/v1/memories/:id/history`, `/v1/tree/root`, `/v1/tree/proof/:idx`, `/v1/attestation`, `/v1/health`.

**Verification UX:** any client recomputes the proof locally; a `dev`-mode (no TEE) deployment is explicitly untrusted.

## 8. Differentiation

- **vs Mem0 / vector DBs:** they store & recall; we add provenance, tamper-evidence, anti-omission, auditable deletes, and operator-can't-tamper — without changing the API shape.
- **vs "trust the host":** the signing key is sealed to the attested image digest; editing memory needs different code → different digest → failed attestation.
- **vs software-only signing:** the TEE is what makes "the operator can't forge" true rather than aspirational.

## 9. Success metrics

**Correctness (must be 100%):** write→read produces a valid proof; tampered memory fails verification; injected (unsigned) memory rejected; deleted memory still auditable; set-proof detects omission.
**Performance (single instance):** write < 50 ms, read+proof < 30 ms, client verify < 5 ms, 1M+ leaves without degradation.
**Adoption:** time-to-first-verified-memory < 10 min; one-command EigenCompute deploy.

## 10. Roadmap

- **v1 (now):** core commitments, proofs, Mem0 API, TEE deploy, SDK, landing.
- **v1.1:** real on-chain root anchoring cadence; full TDX quote verification in `verifyMemory`; published `@…/verifiable-memory-client`.
- **v2:** verifiable semantic search (embeddings inside the TEE / EigenAI); signed memory-sharing grants across agents (Part 2 `StepEnvelope`); EigenDA anchoring for data availability.

## 11. Open questions

1. Merkle root publish cadence on-chain (per-write is costly) — batch every N writes / M seconds?
2. Content encryption at rest (AES-256-GCM) inside the TEE — defense-in-depth vs simplicity.
3. Multi-agent memory visibility — full isolation by `agentId` vs explicit signed sharing.
4. Trusted clock — use Confidential Space trusted time vs system clock (note in attestation).
