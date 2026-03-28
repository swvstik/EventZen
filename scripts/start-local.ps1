param(
    [string]$VaultAddr = $(if ($env:VAULT_ADDR) { $env:VAULT_ADDR } else { "http://127.0.0.1:8200" }),
    [string]$VaultToken = $(if ($env:VAULT_TOKEN) { $env:VAULT_TOKEN } else { "root-dev-token" }),
    [string]$Policy = "root",
    [string]$WrapTtl = "30m",
    [switch]$Detach,
    [switch]$NoBuild,
    [switch]$KeepWrappedToken
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $repoRoot ".env"

if (-not (Test-Path $envFile)) {
    throw "Missing .env at '$envFile'. Copy .env.example to .env first."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI is not installed or not in PATH."
}

Write-Host "[start-local] Using VAULT_ADDR=$VaultAddr"

try {
    $null = Invoke-RestMethod -Method Get -Uri ("{0}/v1/sys/health" -f $VaultAddr.TrimEnd('/')) -TimeoutSec 10
} catch {
    throw "Vault health check failed at $VaultAddr. Ensure Vault is running and reachable."
}

$headers = @{
    "X-Vault-Token" = $VaultToken
    "X-Vault-Wrap-TTL" = $WrapTtl
}
$body = @{
    policies = @($Policy)
    ttl = "1h"
}

try {
    $resp = Invoke-RestMethod -Method Post -Uri ("{0}/v1/auth/token/create" -f $VaultAddr.TrimEnd('/')) -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json)
} catch {
    throw "Failed to generate wrapped token from Vault. Check VAULT_TOKEN and policy permissions."
}

$wrappedToken = $resp.wrap_info.token
if ([string]::IsNullOrWhiteSpace($wrappedToken)) {
    throw "Vault did not return wrap_info.token."
}

$envLines = Get-Content -Path $envFile -Encoding utf8
$updated = $false
for ($i = 0; $i -lt $envLines.Count; $i++) {
    if ($envLines[$i] -match '^VAULT_WRAPPED_SECRET_ID=') {
        $envLines[$i] = "VAULT_WRAPPED_SECRET_ID=$wrappedToken"
        $updated = $true
        break
    }
}
if (-not $updated) {
    $envLines += "VAULT_WRAPPED_SECRET_ID=$wrappedToken"
}
Set-Content -Path $envFile -Value $envLines -Encoding utf8

Write-Host "[start-local] Generated fresh wrapped token and updated .env"

Push-Location $repoRoot
try {
    $composeArgs = @("compose", "up")
    if (-not $NoBuild) {
        $composeArgs += "--build"
    }
    if ($Detach) {
        $composeArgs += "-d"
    }

    Write-Host "[start-local] Running: docker $($composeArgs -join ' ')"
    & docker @composeArgs
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location

    if (-not $KeepWrappedToken) {
        $envLines = Get-Content -Path $envFile -Encoding utf8
        for ($i = 0; $i -lt $envLines.Count; $i++) {
            if ($envLines[$i] -match '^VAULT_WRAPPED_SECRET_ID=') {
                $envLines[$i] = "VAULT_WRAPPED_SECRET_ID="
                break
            }
        }
        Set-Content -Path $envFile -Value $envLines -Encoding utf8
        Write-Host "[start-local] Cleared VAULT_WRAPPED_SECRET_ID in .env"
    }
}
