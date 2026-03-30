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

1. Generates a fresh wrapped token
2. Writes it to `.env`
3. Starts Docker Compose
4. Clears `VAULT_WRAPPED_SECRET_ID` from `.env` after startup (security)

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
