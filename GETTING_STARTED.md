# EventZen Getting Started

This document is a full, professor-friendly setup flow for running EventZen with Docker + Vault.

Runtime model used by this project:

1. Secrets are stored in Vault at one shared path.
2. You pass one wrapped token in `.env`.
3. Startup unwraps once and injects secrets into app services.

No local secret file is required at runtime.

## 1) Install prerequisites

Required:

- Docker Desktop (running)
- Docker Compose v2
- Vault server (running)
- Vault CLI (recommended for easy token generation)

Install Vault CLI on Windows (pick one):

```powershell
winget install HashiCorp.Vault
```

or

```powershell
choco install vault
```

Verify tools:

```powershell
docker --version
docker compose version
vault --version
```

## 2) Start Vault (if you do not already have one)

If you already run Vault locally, skip this section.

Quick local dev Vault using Docker:

```powershell
docker run --name eventzen-vault -d --cap-add=IPC_LOCK -e VAULT_DEV_ROOT_TOKEN_ID=root-dev-token -e VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200 -p 8200:8200 hashicorp/vault:1.16
```

Set host shell variables for Vault CLI:

```powershell
$env:VAULT_ADDR = "http://127.0.0.1:8200"
$env:VAULT_TOKEN = "root-dev-token"
vault status
```

Container connectivity check (important):

```powershell
docker run --rm curlimages/curl:8.12.1 curl -fsS http://host.docker.internal:8200/v1/sys/health
```

## 3) Prepare `.env`

Copy template:

```powershell
Copy-Item .env.example .env
```

Open `.env` and set at least these keys:

- VAULT_ADDR
- VAULT_DOCKER_ADDR
- VAULT_SKIP_TLS_VERIFY
- VAULT_KV_MOUNT
- VAULT_KV_PATH
- EZ_VAULT_WRAP_PATH
- VAULT_WRAPPED_SECRET_ID (leave blank for now)
- MYSQL_ROOT_PASSWORD
- MINIO_ROOT_USER
- MINIO_ROOT_PASSWORD
- GRAFANA_ADMIN_USER
- GRAFANA_ADMIN_PASSWORD

Recommended defaults:

- VAULT_ADDR=http://127.0.0.1:8200
- VAULT_DOCKER_ADDR=http://host.docker.internal:8200
- VAULT_SKIP_TLS_VERIFY=true
- VAULT_KV_MOUNT=secret
- VAULT_KV_PATH=eventzen/ez-secrets
- EZ_VAULT_WRAP_PATH=auth/token/create

## 4) Put secrets into Vault

Use `vault-secrets.example.json` as the required key list.

If KV v2 mount `secret` does not exist yet:

```powershell
vault secrets enable -path=secret kv-v2
```

Use Vault UI for the secret data itself:

1. Open Vault UI.
2. Open KV v2 mount `secret`.
3. Create/edit path `eventzen/ez-secrets`.
4. Copy all keys from `vault-secrets.example.json` and set real values.

Important:

- Key names must match exactly.
- Missing keys can cause service startup failure.

## 5) Generate one wrapped token

Local dev command (simple):

```powershell
$wrap = vault token create -policy=root -ttl=1h -wrap-ttl=30m -format=json | ConvertFrom-Json
$wrap.wrap_info.token
```

Put that token into `.env`:

```dotenv
VAULT_WRAPPED_SECRET_ID=<wrapped-token>
```

Rules:

- Wrapped tokens are single-use.
- Wrapped tokens expire.
- Generate a new wrapped token before each `docker compose up`.

## 6) Start EventZen

From repository root:

```powershell
docker compose up --build
```

Or run the helper to generate a fresh wrapped token and start automatically:

```powershell
./scripts/start-local.ps1
```

What startup does:

1. `vault-preflight` checks Vault availability.
2. `vault-secrets-init` validates and unwraps your wrapped token.
3. Shared runtime token is written to an internal volume.
4. App services read `secret/eventzen/ez-secrets` and export env vars.
5. Services become healthy.

## 7) Verify running state

Gateway health:

```powershell
curl http://localhost:8080/health
```

Container state:

```powershell
docker compose ps
```

Useful UIs:

- App/Gateway: http://localhost:8080
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090
- MinIO Console: http://localhost:9001

## 8) Stop and reset

Stop:

```powershell
docker compose down
```

Stop + wipe volumes:

```powershell
docker compose down -v
```

After `down -v`, run again with a fresh wrapped token.

## 9) Troubleshooting (real failures)

If startup fails, run:

```powershell
docker compose logs --no-color --tail=200 vault-secrets-init user-seed node-service spring-service dotnet-service nginx-gateway
```

Most common error:

- `vault-secrets-init: wrapping lookup failed: wrapping token is not valid or does not exist`
- Meaning: token missing, expired, or already consumed.
- Fix: generate a fresh wrapped token and retry.

## 10) Do these `.env` values accept any value?

Not all of them.

Works if any valid value:

- MYSQL_ROOT_PASSWORD
- MINIO_ROOT_USER
- MINIO_ROOT_PASSWORD
- GRAFANA_ADMIN_USER
- GRAFANA_ADMIN_PASSWORD

Must match your Vault/runtime topology:

- VAULT_ADDR: where host CLI reaches Vault.
- VAULT_DOCKER_ADDR: where containers reach Vault.
- VAULT_SKIP_TLS_VERIFY: true only for local/dev self-signed setups.
- VAULT_KV_MOUNT: must match actual KV mount name.
- VAULT_KV_PATH: must match actual secret path.
- EZ_VAULT_WRAP_PATH: must match wrapping creation path (default `auth/token/create`).
- VAULT_WRAPPED_SECRET_ID: must be fresh, valid, single-use wrapped token.

If Vault values are wrong, startup fails even if secret contents are correct.

## 11) Security notes

- Do not commit `.env`.
- Do not store long-lived production tokens in `.env`.
- Rotate secrets if exposed in logs/chat/screenshots.
- For production, replace root policy token flow with a least-privilege policy.

---

Minimum path to success:

1. Sections 3, 4, 5, 6.
2. If it fails, run section 9 command and fix token/path mismatch first.

Optional helper flags:

- `./scripts/start-local.ps1 -Detach` starts in background.
- `./scripts/start-local.ps1 -NoBuild` skips image rebuild.
- `./scripts/start-local.ps1 -KeepWrappedToken` keeps token in `.env` after run.