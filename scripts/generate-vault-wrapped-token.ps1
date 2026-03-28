param(
    [string]$VaultAddr = $(if ($env:VAULT_ADDR) { $env:VAULT_ADDR } else { "http://127.0.0.1:8200" }),
    [string]$VaultToken = $(if ($env:VAULT_TOKEN) { $env:VAULT_TOKEN } else { "root-dev-token" }),
    [string]$Policy = "root",
    [string]$TokenTtl = "1h",
    [string]$WrapTtl = "30m",
    [switch]$UpdateEnv,
    [string]$EnvFile = $(Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path ".env")
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command Invoke-RestMethod -ErrorAction SilentlyContinue)) {
    throw "PowerShell Invoke-RestMethod is not available in this shell."
}

$vaultHealthUri = "{0}/v1/sys/health" -f $VaultAddr.TrimEnd('/')
$tokenCreateUri = "{0}/v1/auth/token/create" -f $VaultAddr.TrimEnd('/')

try {
    $null = Invoke-RestMethod -Method Get -Uri $vaultHealthUri -TimeoutSec 10
} catch {
    throw "Vault health check failed at $VaultAddr. Ensure Vault is running and reachable."
}

$headers = @{
    "X-Vault-Token" = $VaultToken
    "X-Vault-Wrap-TTL" = $WrapTtl
}

$body = @{
    policies = @($Policy)
    ttl = $TokenTtl
}

try {
    $resp = Invoke-RestMethod -Method Post -Uri $tokenCreateUri -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json)
} catch {
    throw "Failed to generate wrapped token from auth/token/create. Check VAULT_TOKEN and policy permissions."
}

$wrappedToken = $resp.wrap_info.token
if ([string]::IsNullOrWhiteSpace($wrappedToken)) {
    throw "Vault response did not include wrap_info.token."
}

Write-Host "Generated wrapped token (creation path: auth/token/create)."
Write-Host "Paste this into VAULT_WRAPPED_SECRET_ID if you are running docker compose manually:"
Write-Output $wrappedToken

if ($UpdateEnv) {
    if (-not (Test-Path $EnvFile)) {
        throw "Cannot update .env. File not found: $EnvFile"
    }

    $envLines = Get-Content -Path $EnvFile -Encoding utf8
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

    Set-Content -Path $EnvFile -Value $envLines -Encoding utf8
    Write-Host "Updated VAULT_WRAPPED_SECRET_ID in $EnvFile"
}

Write-Host "Note: wrapped tokens are single-use and expire. Generate a fresh one before each docker compose up run."
