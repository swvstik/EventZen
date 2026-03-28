# EventZen Vault Scripts

This folder contains runtime bootstrap support for Docker Compose.
All app/runtime secrets are stored at one shared path:

- `secret/eventzen/ez-secrets`

## Prerequisites

- Vault UI/client access and a running Vault server.
- KV v2 mount `secret` available.
- Access to create/read values at `secret/eventzen/ez-secrets`.

## 1) Prepare secrets in Vault UI

Use `vault-secrets.example.json` from the repository root as the required key template.
Create or update those key/value pairs in the Vault UI at:

- `secret/eventzen/ez-secrets`

Do not create local secret JSON files for runtime.

## 2) Set wrapped token in `.env`

Generate one wrapped token using your Vault client and place it in `.env`:

- `VAULT_WRAPPED_SECRET_ID=<wrapped-token>`

Generate a fresh wrapped token before each `docker compose up` because wrapped tokens are single-use and short-lived.

## 3) Start the stack

```powershell
docker compose up --build
```

Or use the helper to auto-generate a fresh wrapped token and start:

```powershell
./scripts/start-local.ps1
```

`vault-secrets-init` bootstraps once with:

1. Wrapping token lookup
2. Wrapping token unwrap (single use)
3. Writes shared Vault `client_token` file in volume

Each app container then bootstraps with:

1. Reads shared Vault `client_token`
2. KV secret read
3. Export secrets to process environment
4. App process start

## Notes

- App services are dotenv-less after this migration.
- One wrapped token cannot be reused after unwrap; generate a fresh token before each compose startup.
- Vault is a hard startup dependency for app services via compose preflight checks.
- For production-hardening later: enable TLS, set strict TTL/CIDR policies, and replace root token workflows.
