# Deploying to EigenCompute (Intel TDX TEE)

This service is designed to run as a Docker image inside an EigenCompute TEE, so
that the operator cannot read or tamper with memories and clients can verify
exactly which code produced every commitment.

## How the trust model maps to EigenCompute

| Piece | EigenCompute mechanism |
| --- | --- |
| Code can't be swapped silently | The deployed Docker image **digest** is recorded in the attestation. |
| Signing key can't leak to the operator | The **KMS releases the signing key only to the attested, whitelisted image digest**. |
| Memory store is private | PostgreSQL runs inside the TDX enclave (encrypted memory). |
| Anyone can check it | The **Verifiability Dashboard** shows the app id, release history, image digests, and TDX attestations. |

Because the root-signing key only exists inside the attested image, a forged or
edited memory would require a different image — which produces a different
digest and fails attestation. That is the "operator can't tamper" guarantee.

## Prerequisites

- Docker
- The `ecloud` CLI (EigenCompute) — see https://docs.eigencloud.xyz/eigencompute/get-started/quickstart
- A Postgres instance reachable from the enclave (provisioned in-TEE)

## Deploy

```bash
# 1. authenticate the CLI (per EigenCloud docs)
ecloud auth login

# 2. build (linux/amd64), push, and deploy the image into a TEE
ecloud deploy            # uses ./Dockerfile

# 3. the CLI prints the Application ID and the image digest;
#    confirm the digest on the Verifiability Dashboard
```

### Environment the runtime injects (do not set these yourself)

| Var | Provided by | Used for |
| --- | --- | --- |
| `SIGNER_PRIVATE_KEY` / `SIGNER_PUBLIC_KEY` | EigenCompute KMS (bound to image digest) | signing Merkle roots |
| `TDX_QUOTE` | TDX runtime | served at `GET /v1/attestation` |
| `IMAGE_DIGEST` | EigenCompute | put in the attestation for clients to match |
| `EIGEN_APP_ID` | EigenCompute | identifies the app on the dashboard |
| `DATABASE_URL` | your in-TEE Postgres | persistent, encrypted store |

If `SIGNER_PRIVATE_KEY` is absent the service starts in **dev mode** with an
ephemeral key and `attestation.mode = "dev"` — clients (via `verifyRead` with an
`expectedImageDigest`) will refuse to trust it. That is intentional: only a real
enclave run is production-safe.

## What a client does

```ts
import { verifyRead } from "chorus";

// 1. read the digest the app is supposed to be running, off the dashboard
const expectedDigest = "sha256:…";

// 2. fetch a memory + proof and its attestation from the service
const read = await (await fetch(`${base}/v1/memory/${id}`, { headers })).json();

// 3. verify locally — all four checks must pass
const result = verifyRead(read, read.attestation, expectedDigest);
if (!result.ok) throw new Error(result.reasons.join("; "));
```

`verifyRead` checks: (1) the attestation is TEE-mode with the expected image
digest, (2) the signed Merkle root really came from the attested key, (3) the
entry hashes to its leaf, and (4) the leaf is included under that root.
