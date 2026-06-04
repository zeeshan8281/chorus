# Deploying to EigenCompute (Intel TDX TEE)

The service is one Docker container — Node 20 + PostgreSQL 16 co-located — deployed into an Intel TDX enclave via the `ecloud` CLI.

## Trust model on EigenCompute

| Guarantee | Mechanism |
| --- | --- |
| Code can't be swapped silently | the deployed image **digest** is recorded on-chain |
| Signing key can't leak to the operator | the **KMS seals the key to the attested image digest** (`/usr/local/bin/kms-*`) |
| Memory store is private | PostgreSQL runs inside the enclave on the encrypted `/data` volume |
| Anyone can check it | the **Verifiability Dashboard** + `GET /v1/attestation` |

The root-signing key only exists inside the attested image, so a forged or edited memory needs different code → a different digest → failed attestation.

## Prerequisites

```bash
npm i -g @layr-labs/ecloud-cli      # the `ecloud` CLI
ecloud auth login                   # stores a private key in the OS keyring
```

You'll need a small amount of Sepolia ETH (~0.008 ETH per deploy).

## Deploy

```bash
ecloud compute app create --name verifiable-memory --language typescript
ecloud compute app deploy           # choose "Build and deploy from Dockerfile"

ecloud compute app list             # find your APP_ID
ecloud compute app info  <APP_ID>   # status, URL, image digest, attestation
ecloud compute app logs  <APP_ID>
```

`ecloud compute app deploy` builds the included `Dockerfile` (linux/amd64), pushes it, and runs it in a TDX VM. Each deployment gets a unique TEE wallet.

### Runtime environment

The enclave entrypoint (`scripts/entrypoint.sh`) sources sealed secrets via `/usr/local/bin/compute-source-env.sh`, then initializes PostgreSQL on the `/data` volume and starts the service. The attestation endpoint reports:

- `ECLOUD_APP_ID` → deployment id
- `IMAGE_DIGEST` → the attested image (match it on the dashboard)
- the KMS signing-key fingerprint (`/usr/local/bin/kms-signing-public-key.pem`)
- the TEE wallet public key + 0x address

If `ECLOUD_APP_ID` / the KMS key are absent (i.e. not in a TEE), the service reports `attestation.mode: "dev"` and clients refuse to trust it.

## Verify

```bash
curl https://<app-url>/v1/attestation
```

Then confirm the image digest at **https://verify-sepolia.eigencloud.xyz**.

> Known EigenCompute quirks: the API rate-limits after deploys (wait 30–60s before `app list`/`app info`); IPs change on every deploy; `app logs` can 403 (the service logs to stdout and exposes `/v1/health` as a fallback).
