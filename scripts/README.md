# Scripts

This folder contains helper scripts for local development and verification.

## generate-vault-wrapped-token.ps1

Generates a Vault wrapped token using `auth/token/create`.
Use this when running `docker compose up` manually and you need a value for `VAULT_WRAPPED_SECRET_ID` in `.env`.

### Basic usage

```powershell
./scripts/generate-vault-wrapped-token.ps1
```

The script prints a wrapped token that you can paste into `.env`:

```dotenv
VAULT_WRAPPED_SECRET_ID=<wrapped-token>
```

### Optional: update .env automatically

```powershell
./scripts/generate-vault-wrapped-token.ps1 -UpdateEnv
```

### Optional parameters

```powershell
./scripts/generate-vault-wrapped-token.ps1 \
  -VaultAddr "http://127.0.0.1:8200" \
  -VaultToken "root-dev-token" \
  -Policy "root" \
  -TokenTtl "1h" \
  -WrapTtl "30m"
```

## start-local.ps1

Generates a fresh wrapped token, writes it to `.env`, starts Docker Compose, then clears `VAULT_WRAPPED_SECRET_ID` by default.

### Usage

```powershell
./scripts/start-local.ps1
```

Common options:

```powershell
./scripts/start-local.ps1 -Detach -NoBuild
./scripts/start-local.ps1 -KeepWrappedToken
```

## generate_users.ps1

Generates development users for local workflows.

## run_quality_gate.ps1

Runs the repository quality gate checks.

## vault/

Contains Vault bootstrap/runtime helper scripts used by services at startup.

## Notes

- Wrapped tokens are single-use and expire quickly.
- Generate a fresh token before each `docker compose up` run.
- Keep `.env` out of source control.
