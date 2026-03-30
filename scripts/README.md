# Scripts

Helper scripts for local development, Vault setup, and quality verification.

> [!NOTE]
> **Linux users:** These scripts require **PowerShell 7+** (`pwsh`).
> Install via: `sudo snap install powershell --classic`

## generate-vault-wrapped-token.ps1

Generates a Vault wrapped token using `auth/token/create`.
Use this when running `docker compose up` manually and you need to populate `VAULT_WRAPPED_SECRET_ID` in `.env`.

> [!IMPORTANT]
> Wrapped tokens are **single-use** and expire quickly. Generate a fresh one before each `docker compose up` run.

### Basic usage — print token

```powershell
./scripts/generate-vault-wrapped-token.ps1
```

Copy the printed value into `.env`:

```dotenv
VAULT_WRAPPED_SECRET_ID=<wrapped-token>
```

### Auto-write into .env

```powershell
./scripts/generate-vault-wrapped-token.ps1 -UpdateEnv
```

### Optional parameters

```powershell
./scripts/generate-vault-wrapped-token.ps1 `
  -VaultAddr "http://127.0.0.1:8200" `
  -VaultToken "root-dev-token" `
  -Policy "root" `
  -TokenTtl "1h" `
  -WrapTtl "30m"
```

## start-local.ps1

The recommended way to start EventZen locally. Automatically:

1. Uploads `vault-secrets.local.json` when present (new KV version at the same path)
2. Uses existing hosted Vault path when local file is absent
3. Generates a fresh wrapped token
4. Writes it to `.env`
5. Starts Docker Compose
6. Clears `VAULT_WRAPPED_SECRET_ID` from `.env` after startup (security)

### Usage

```powershell
./scripts/start-local.ps1
```

### Optional flags

| Flag | Effect |
|---|---|
| `-Detach` | Run stack in the background (`docker compose up -d`) |
| `-NoBuild` | Skip image rebuild (faster restart when code hasn't changed) |
| `-KeepWrappedToken` | Leave `VAULT_WRAPPED_SECRET_ID` in `.env` after startup |
| `-GatewayHealthUrl` | Health endpoint used for readiness checks in detached mode (default: `http://localhost:8080/health`) |
| `-StartupWaitSeconds` | Max seconds to wait for stack readiness in detached mode (default: `180`) |
| `-StartupPollIntervalSeconds` | Poll interval in seconds for readiness checks (default: `5`) |
| `-ComposeRetryCount` | Number of automatic compose retries on failure (default: `2`) |
| `-ComposeRetryDelaySeconds` | Delay between retries in seconds (default: `10`) |

## quickstart.ps1

One-command bootstrap for local development from Vault setup to app startup.

### What it does

1. Creates `.env` from `.env.example` if missing
2. Uses your existing `vault-secrets.local.json` (required by default)
3. Starts Vault dev container (`eventzen-vault`) if needed
4. Ensures Vault mount `secret/` (KV v2) exists
5. Calls `start-local.ps1` to upload secrets, generate wrapped token, and start compose

If `vault-secrets.local.json` is missing, quickstart fails with setup guidance unless you explicitly pass `-AllowGeneratedDevSecrets`.

### Usage

```powershell
./scripts/quickstart.ps1 -Detach
```

### Optional flags

| Flag | Effect |
|---|---|
| `-Detach` | Run stack in the background |
| `-NoBuild` | Skip image rebuild |
| `-AllowGeneratedDevSecrets` | Create `vault-secrets.local.json` from the example with generated placeholder secrets (dev-only fallback) |
| `-KeepWrappedToken` | Keep wrapped token in `.env` after startup |
| `-SkipVaultContainer` | Skip starting/creating local Vault container (use external Vault) |
| `-GatewayHealthUrl` | Forwarded to `start-local.ps1`; health endpoint for readiness checks |
| `-StartupWaitSeconds` | Forwarded to `start-local.ps1`; max wait time for readiness |
| `-StartupPollIntervalSeconds` | Forwarded to `start-local.ps1`; readiness poll interval |
| `-ComposeRetryCount` | Forwarded to `start-local.ps1`; compose retry attempts (default: `2`) |
| `-ComposeRetryDelaySeconds` | Forwarded to `start-local.ps1`; delay between retries in seconds (default: `10`) |

## run_quality_gate.ps1

Runs the full repository quality gate from the project root:

```powershell
./scripts/run_quality_gate.ps1
```

Checks: Node unit tests, Kafka integration tests (optional), Spring tests, .NET tests, ESLint, and frontend build.

To skip Kafka integration:

```powershell
./scripts/run_quality_gate.ps1 -WithKafkaIntegration:$false
```

## generate_users.ps1

A development utility for generating or resetting local test user data.

> [!NOTE]
> This script is separate from the **Docker Compose user seeding** done by the `user-seed` service (which runs `npm run seed:users` inside Node). Use `generate_users.ps1` only if you need custom user generation outside of Compose.

## vault/

Internal Vault bootstrap and runtime helper scripts used by Docker services at startup (`vault-preflight`, `vault-secrets-init`). **These are not intended to be run manually.**

## Notes

- Keep `.env` out of source control — it contains secrets.
- If you run `docker compose down -v` (removes volumes), generate a fresh wrapped token before the next `up`.
