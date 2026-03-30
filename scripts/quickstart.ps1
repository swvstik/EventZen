param(
    [string]$VaultAddr = $(if ($env:VAULT_ADDR) { $env:VAULT_ADDR } else { "http://127.0.0.1:8200" }),
    [string]$VaultToken = $(if ($env:VAULT_TOKEN) { $env:VAULT_TOKEN } else { "root-dev-token" }),
    [string]$GatewayHealthUrl = $(if ($env:GATEWAY_HEALTH_URL) { $env:GATEWAY_HEALTH_URL } else { "http://localhost:8080/health" }),
    [int]$StartupWaitSeconds = 180,
    [int]$StartupPollIntervalSeconds = 5,
    [int]$ComposeRetryCount = 2,
    [int]$ComposeRetryDelaySeconds = 10,
    [switch]$AllowGeneratedDevSecrets,
    [switch]$Detach,
    [switch]$NoBuild,
    [switch]$KeepWrappedToken,
    [switch]$SkipVaultContainer
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$envExampleFile = Join-Path $repoRoot ".env.example"
$envFile = Join-Path $repoRoot ".env"
$secretsExampleFile = Join-Path $repoRoot "vault-secrets.example.json"
$secretsLocalFile = Join-Path $repoRoot "vault-secrets.local.json"
$startLocalScript = Join-Path $PSScriptRoot "start-local.ps1"

function New-StrongSecret {
    param([int]$Bytes = 48)

    $buffer = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return [Convert]::ToBase64String($buffer)
}

function Wait-ForVaultHealth {
    param(
        [string]$Address,
        [int]$Attempts = 30,
        [int]$DelaySeconds = 2
    )

    $healthUri = "{0}/v1/sys/health" -f $Address.TrimEnd('/')
    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            $null = Invoke-RestMethod -Method Get -Uri $healthUri -TimeoutSec 5
            return
        } catch {
            if ($i -eq $Attempts) {
                throw "Vault health check failed at '$Address' after $Attempts attempts."
            }
            Start-Sleep -Seconds $DelaySeconds
        }
    }
}

function Ensure-VaultDevContainer {
    param(
        [string]$ContainerName = "eventzen-vault"
    )

    $exists = (& docker ps -a --filter "name=^/$ContainerName$" --format "{{.Names}}" | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($exists)) {
        Write-Host "[quickstart] Creating local Vault dev container '$ContainerName'."
        & docker run --name $ContainerName -d --cap-add=IPC_LOCK -e VAULT_DEV_ROOT_TOKEN_ID=root-dev-token -e VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200 -p 8200:8200 hashicorp/vault:1.16 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create Vault dev container '$ContainerName'."
        }
        return
    }

    $running = (& docker ps --filter "name=^/$ContainerName$" --format "{{.Names}}" | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($running)) {
        Write-Host "[quickstart] Starting existing Vault container '$ContainerName'."
        & docker start $ContainerName | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to start Vault container '$ContainerName'."
        }
    } else {
        Write-Host "[quickstart] Vault container '$ContainerName' is already running."
    }
}

function Ensure-VaultKvMount {
    param(
        [string]$Address,
        [string]$Token,
        [string]$Mount = "secret"
    )

    $headers = @{ "X-Vault-Token" = $Token }
    $mountsUri = "{0}/v1/sys/mounts" -f $Address.TrimEnd('/')

    try {
        $mounts = Invoke-RestMethod -Method Get -Uri $mountsUri -Headers $headers -TimeoutSec 10
    } catch {
        throw "Failed to list Vault mounts. Verify VAULT_TOKEN permissions."
    }

    $mountKey = "{0}/" -f $Mount.Trim('/')
    if ($null -ne $mounts.data.PSObject.Properties[$mountKey]) {
        Write-Host "[quickstart] Vault mount '$mountKey' already exists."
        return
    }

    $enableUri = "{0}/v1/sys/mounts/{1}" -f $Address.TrimEnd('/'), $Mount.Trim('/')
    $body = @{ type = "kv"; options = @{ version = "2" } } | ConvertTo-Json

    try {
        $null = Invoke-RestMethod -Method Post -Uri $enableUri -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 10
        Write-Host "[quickstart] Enabled Vault KV v2 mount at '$mountKey'."
    } catch {
        throw "Failed to enable Vault mount '$mountKey'. Verify VAULT_TOKEN permissions."
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI is not installed or not in PATH."
}

if (-not (Test-Path $envFile)) {
    if (-not (Test-Path $envExampleFile)) {
        throw "Missing '.env.example' at '$envExampleFile'."
    }
    Copy-Item -Path $envExampleFile -Destination $envFile
    Write-Host "[quickstart] Created '.env' from '.env.example'."
}

if (-not (Test-Path $secretsLocalFile)) {
    if (-not $AllowGeneratedDevSecrets) {
        throw "Missing '$secretsLocalFile'. Create it first (for example: Copy-Item .\\vault-secrets.example.json .\\vault-secrets.local.json) and fill your real values. If you only want generated dev placeholders, run quickstart with -AllowGeneratedDevSecrets."
    }

    if (-not (Test-Path $secretsExampleFile)) {
        throw "Missing 'vault-secrets.example.json' at '$secretsExampleFile'."
    }

    Copy-Item -Path $secretsExampleFile -Destination $secretsLocalFile

    $secrets = Get-Content -Path $secretsLocalFile -Encoding utf8 -Raw | ConvertFrom-Json
    $jwtSecret = New-StrongSecret
    $internalSecret = New-StrongSecret
    $tokenHashSecret = New-StrongSecret
    $mysqlPassword = New-StrongSecret -Bytes 24

    $secrets.JWT_SECRET = $jwtSecret
    $secrets.INTERNAL_SERVICE_SECRET = $internalSecret
    $secrets.TOKEN_HASH_SECRET = $tokenHashSecret
    $secrets.JWT__Secret = $jwtSecret
    $secrets.Spring__InternalSecret = $internalSecret
    $secrets.Node__InternalSecret = $internalSecret
    $secrets.SPRING_DATASOURCE_PASSWORD = $mysqlPassword
    $secrets.MYSQL_ROOT_PASSWORD = $mysqlPassword

    $json = $secrets | ConvertTo-Json -Depth 20
    Set-Content -Path $secretsLocalFile -Encoding utf8 -Value $json

    Write-Host "[quickstart] Created 'vault-secrets.local.json' with generated development secrets (AllowGeneratedDevSecrets)."
}

if (-not $SkipVaultContainer) {
    Ensure-VaultDevContainer
}

Wait-ForVaultHealth -Address $VaultAddr
Ensure-VaultKvMount -Address $VaultAddr -Token $VaultToken

Write-Host "[quickstart] Handing off to start-local script."

$startArgs = @{
    VaultAddr = $VaultAddr
    VaultToken = $VaultToken
    GatewayHealthUrl = $GatewayHealthUrl
    StartupWaitSeconds = $StartupWaitSeconds
    StartupPollIntervalSeconds = $StartupPollIntervalSeconds
    ComposeRetryCount = $ComposeRetryCount
    ComposeRetryDelaySeconds = $ComposeRetryDelaySeconds
}

if ($Detach) { $startArgs.Detach = $true }
if ($NoBuild) { $startArgs.NoBuild = $true }
if ($KeepWrappedToken) { $startArgs.KeepWrappedToken = $true }

& $startLocalScript @startArgs
if ($LASTEXITCODE -ne 0) {
    throw "start-local failed with exit code $LASTEXITCODE"
}
