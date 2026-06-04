<div align="center">

# 🛡️ Verifiable Agent Memory

### Tamper-evident persistent memory for AI agents — running in an Intel TDX TEE on EigenCompute

Every memory write is **hashed, secp256k1-signed, and committed to a Merkle tree**; every read returns a **Merkle inclusion proof**. Because the layer runs inside an EigenCompute TEE with the signing key sealed to the attested image, **the operator can't inject, edit, delete, or replay a memory** — and any client can prove it.

*Observability Series, Part 3 — EigenLabs.*

[![Node](https://img.shields.io/badge/node-20-8ae06c)](https://nodejs.org)
[![TEE](https://img.shields.io/badge/TEE-Intel%20TDX%20·%20EigenCompute-a77dff)](https://docs.eigencloud.xyz/eigencompute)
[![License: MIT](https://img.shields.io/badge/license-MIT-a77dff)](LICENSE)

</div>

> Repo/package: `verifiable-agent-memory` (the repo is hosted at `github.com/zeeshan8281/chorus`).

---

## The problem

Agent memory layers are opaque databases controlled by whoever runs the infra. Nothing stops an operator from **injecting** false memories, **tampering** with stored ones, **deleting** evidence, or **replaying** stale state. If you control what an agent remembers, you control what it does. This project makes the memory layer **verifiable**.

| Attack | Defense |
| --- | --- |
| Inject false memory | every commitment is secp256k1-signed by the TEE key; unsigned rows don't verify |
| Tamper with content | content is bound into a Merkle leaf — edits break the inclusion proof |
| Delete evidence | soft-delete only; a signed `DELETE` is appended to the append-only tree |
| Replay stale state | each read returns the current signed root; the tree only grows |

## How it works

```
            ┌──────────── Intel TDX enclave (EigenCompute) ───────────┐
 agent ─────│ write → canonicalize → SHA-256 → secp256k1 sign         │
            │       → append Merkle leaf → sign root → commitment log │
            │ PostgreSQL 16 (encrypted)     GET /v1/attestation       │
 agent ─────│ read  → memory + inclusion proof + signed root          │
            └───────────────────────────────────────────────────────────┘
                                   │
 verifyMemory():  ① TEE key matches attestation   ② signature valid
                  ③ content hashes to its leaf     ④ leaf ∈ signed root
```

## Quickstart

```ts
import { MemoryService, verifyMemory } from "verifiable-agent-memory";

const m = await svc.create({
  content: "User authorized $50/mo to Acme Corp",
  agentId: "billing-agent",
  tags: ["payment", "authorization"],
});

const read = await svc.get(m.id);             // memory + Merkle proof + attestation
const result = verifyMemory(read, read.teePublicKey);
result.ok;     // true
result.checks; // { teeKey, contentHash, signature, leafBinding, inclusion, rootMatch }
```

```bash
npm install
npm test            # 16 tests: merkle, secp256k1 commitments, service e2e, tamper, set-proof
npm run demo        # create → verify → update → search → soft-delete
npm run demo:tamper # operator edits the DB → verification fails
npm run dev         # HTTP service (in-memory store, dev attestation)
```

## HTTP API (Mem0-compatible)

```bash
npm run build && npm start            # dev: in-memory store
DATABASE_URL=postgres://… npm start   # the in-TEE path: PostgreSQL
```

| Method & path | Purpose |
| --- | --- |
| `POST /v1/memories` | Create (hashed, signed, committed) — `201` |
| `GET /v1/memories/:id` | Read **with inclusion proof + attestation** |
| `PUT /v1/memories/:id` | Update — archives the prior version, re-commits |
| `DELETE /v1/memories/:id` | Soft-delete — returns a signed deletion receipt |
| `GET /v1/memories?agentId=…&tags=…` | Search — proofs + **set-completeness proof** |
| `GET /v1/memories/:id/history` | Version history |
| `GET /v1/tree/root` | Current signed Merkle root |
| `GET /v1/tree/proof/:leafIndex` | Inclusion proof for a leaf |
| `GET /v1/attestation` | TDX attestation (image digest, KMS fingerprint, TEE key) |
| `GET /v1/health` | Liveness + tree size + current root |

## Deploy on EigenCompute

See **[DEPLOY.md](DEPLOY.md)**. In short:

```bash
ecloud compute app create --name verifiable-memory --language typescript
ecloud compute app deploy          # choose "Build and deploy from Dockerfile"
```

The `Dockerfile` ships Node 20 + **PostgreSQL 16 co-located** in one TEE container. The KMS seals the signing key to the attested image digest; verify it at **verify-sepolia.eigencloud.xyz**. Without a TEE the service runs in **dev mode** (ephemeral key, `attestation.mode: "dev"`), which clients refuse to trust.

## Architecture

```
src/
  commitment/   canonicalize · hasher (SHA-256) · signer (secp256k1, eth address)
  merkle/       append-only tree: leaf hash, root, inclusion proof, verify
  services/     memory-service (create/get/update/delete/search/history) · expiration sweep
  db/           Store interface · MemStore (tests/dev) · PgStore (PRD schema)
  tee/          wallet (sealed key) · attestation (TDX + KMS fingerprint)
  telemetry/    OTel spans (Part 1 — Eigen Trace Mirror integration)
  routes/       Express routers (memories · tree · attestation · health)
  client/       VerifiableMemoryClient SDK + verifyMemory()
scripts/        schema.sql · entrypoint.sh (sealed-env + Postgres init)
Dockerfile      Node 20 + PostgreSQL 16, deployed via ecloud
site/           Vite + React + TS landing page (Eigen brand)
```

**Design note (intentional deviation from the PRD):** the services use a `Store` interface (with `MemStore` + `PgStore`) instead of raw SQL inline, so the exact same commitment/Merkle/verify path is unit-testable without a live database. `PgStore` implements the PRD schema (`memories`, `merkle_nodes`, `commitment_log`, `memory_versions`); the Merkle tree is recomputed from persisted level-0 leaves (PRD §12, open question #1).

## License

MIT
