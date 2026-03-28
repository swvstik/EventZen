# EventZen Getting Started

This is the fastest, most explicit setup guide for running EventZen locally with Docker and Vault.

If you follow this document top to bottom, you should get a working stack on first run.

## Runtime Model (Important)

EventZen startup is Vault-first:

1. Secrets live in Vault at one shared KV path.
2. You provide one wrapped token in `.env` (`VAULT_WRAPPED_SECRET_ID`).
3. Startup unwraps once and shares a short-lived runtime token through an internal volume.
4. App services load secrets from Vault at boot.

No local runtime secret file is required.

## Quick Path (Recommended)

If Vault is already running and populated, this is enough:

1. Copy `.env.example` to `.env`.
2. Ensure Vault values in `.env` are correct.
3. Run:

```powershell
./scripts/start-local.ps1
```

That helper generates a fresh wrapped token and starts the stack.

## Full Setup (From Zero)

## 1) Prerequisites

Required:

- Docker Desktop running
- Docker Compose v2
- Vault server running
- Vault CLI (recommended)

Install Vault CLI (Windows):

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

## 2) Start Vault (Skip if you already have one)

Quick local Vault container:

```powershell
docker run --name eventzen-vault -d --cap-add=IPC_LOCK -e VAULT_DEV_ROOT_TOKEN_ID=root-dev-token -e VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200 -p 8200:8200 hashicorp/vault:1.16
```

Configure CLI environment:

```powershell
$env:VAULT_ADDR = "http://127.0.0.1:8200"
$env:VAULT_TOKEN = "root-dev-token"
vault status
```

Verify containers can reach Vault:

```powershell
docker run --rm curlimages/curl:8.12.1 curl -fsS http://host.docker.internal:8200/v1/sys/health
```

## 3) Prepare .env

Copy template:

```powershell
Copy-Item .env.example .env
```

Set at least these values in `.env`:

- `VAULT_ADDR=http://127.0.0.1:8200`
- `VAULT_DOCKER_ADDR=http://host.docker.internal:8200`
- `VAULT_SKIP_TLS_VERIFY=true`
- `VAULT_KV_MOUNT=secret`
- `VAULT_KV_PATH=eventzen/ez-secrets`
- `EZ_VAULT_WRAP_PATH=auth/token/create`
- `VAULT_WRAPPED_SECRET_ID=` (leave blank for now)
- `MYSQL_ROOT_PASSWORD=...`
- `MINIO_ROOT_USER=...`
- `MINIO_ROOT_PASSWORD=...`
- `GRAFANA_ADMIN_USER=...`
- `GRAFANA_ADMIN_PASSWORD=...`

Host tooling ports are configurable in `.env` if needed:

- `MONGO_HOST_PORT`
- `MYSQL_HOST_PORT`
- `MINIO_API_HOST_PORT`
- `MINIO_CONSOLE_HOST_PORT`
- `KAFKA_HOST_PORT`
- `PROMETHEUS_HOST_PORT`
- `GRAFANA_HOST_PORT`

## 4) Put Secrets Into Vault

Use `vault-secrets.example.json` as the required key list.

Create KV mount if needed:

```powershell
vault secrets enable -path=secret kv-v2
```

Then in Vault UI:

1. Open KV v2 mount `secret`.
2. Create or edit path `eventzen/ez-secrets`.
3. Add all keys from `vault-secrets.example.json` with real values.

Rules:

- Key names must match exactly.
- Missing keys can cause service startup failure.

## 5) Generate Wrapped Token

Option A (manual output):

```powershell
./scripts/generate-vault-wrapped-token.ps1
```

Copy the printed value into `.env`:

```dotenv
VAULT_WRAPPED_SECRET_ID=<wrapped-token>
```

Option B (auto-write into `.env`):

```powershell
./scripts/generate-vault-wrapped-token.ps1 -UpdateEnv
```

Rules:

- Wrapped token is single-use.
- Wrapped token expires.
- Generate a fresh one before each manual `docker compose up`.

## 6) Start EventZen

Preferred helper:

```powershell
./scripts/start-local.ps1
```

Manual startup:

```powershell
docker compose up --build
```

What startup does:

1. `vault-preflight` checks Vault reachability.
2. `vault-secrets-init` validates and unwraps your wrapped token.
3. Shared runtime token is written to internal volume.
4. Node, Spring, and .NET read Vault secrets and start.
5. Gateway starts after backend healthchecks pass.

## 7) Verify

Health endpoint:

```powershell
curl http://localhost:8080/health
```

Container status:

```powershell
docker compose ps
```

Expected key services:

- `node-service` healthy
- `spring-service` healthy
- `dotnet-service` healthy
- `nginx-gateway` up

Useful UIs:

- App: http://localhost:8080
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090
- MinIO Console: http://localhost:9001

## 8) Stop / Reset

Stop everything:

```powershell
docker compose down
```

Stop and remove volumes:

```powershell
docker compose down -v
```

After `down -v`, generate a fresh wrapped token for next run.

## 9) Troubleshooting

Get focused startup logs:

```powershell
docker compose logs --no-color --tail=200 vault-secrets-init user-seed node-service spring-service dotnet-service nginx-gateway
```

Common failure: wrapped token invalid

- Error: `vault-secrets-init: wrapping lookup failed: wrapping token is not valid or does not exist`
- Meaning: token missing, expired, already consumed, or mismatched path
- Fix:
1. Generate a fresh wrapped token
2. Ensure `EZ_VAULT_WRAP_PATH=auth/token/create`
3. Retry startup

Common failure: Vault not reachable from containers

- Check `VAULT_DOCKER_ADDR`
- Validate with:

```powershell
docker run --rm curlimages/curl:8.12.1 curl -fsS http://host.docker.internal:8200/v1/sys/health
```

Common failure: app services never start

- Usually blocked behind failed `vault-secrets-init`
- Fix Vault issue first, then restart

## 10) Which .env Values Can Be Arbitrary?

Usually arbitrary (valid non-empty values):

- `MYSQL_ROOT_PASSWORD`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `GRAFANA_ADMIN_USER`
- `GRAFANA_ADMIN_PASSWORD`

Must match real topology/config:

- `VAULT_ADDR`
- `VAULT_DOCKER_ADDR`
- `VAULT_SKIP_TLS_VERIFY`
- `VAULT_KV_MOUNT`
- `VAULT_KV_PATH`
- `EZ_VAULT_WRAP_PATH`
- `VAULT_WRAPPED_SECRET_ID`

## 11) Security Notes

- Never commit `.env`.
- Do not keep long-lived production tokens in `.env`.
- Rotate secrets if exposed.
- For production, replace root-policy workflow with least-privilege Vault policies.

## Optional Helper Flags

`scripts/start-local.ps1`:

- `-Detach` run in background
- `-NoBuild` skip image rebuild
- `-KeepWrappedToken` keep wrapped token in `.env` after startup

## Minimum Success Checklist

1. Vault reachable from host and containers
2. `secret/eventzen/ez-secrets` populated
3. Fresh `VAULT_WRAPPED_SECRET_ID`
4. `docker compose up --build` or `./scripts/start-local.ps1`
5. `http://localhost:8080/health` returns OK