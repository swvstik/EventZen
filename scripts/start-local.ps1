param(
    [string]$VaultAddr = $(if ($env:VAULT_ADDR) { $env:VAULT_ADDR } else { "http://127.0.0.1:8200" }),
    [string]$VaultToken = $(if ($env:VAULT_TOKEN) { $env:VAULT_TOKEN } else { "root-dev-token" }),
    [string]$Policy = "root",
    [string]$WrapTtl = "30m",
    [string]$GatewayHealthUrl = $(if ($env:GATEWAY_HEALTH_URL) { $env:GATEWAY_HEALTH_URL } else { "http://localhost:8080/health" }),
    [int]$StartupWaitSeconds = 180,
    [int]$StartupPollIntervalSeconds = 5,
    [int]$ComposeRetryCount = 2,
    [int]$ComposeRetryDelaySeconds = 10,
    [switch]$Detach,
    [switch]$NoBuild,
    [switch]$KeepWrappedToken
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $repoRoot ".env"
$vaultKvMount = if ($env:VAULT_KV_MOUNT) { $env:VAULT_KV_MOUNT } else { "secret" }
$vaultKvPath = if ($env:VAULT_KV_PATH) { $env:VAULT_KV_PATH } else { "eventzen/ez-secrets" }
$vaultSecretsFile = Join-Path $repoRoot "vault-secrets.local.json"

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

function Get-HttpStatusCode {
    param([System.Exception]$Exception)

    if ($null -ne $Exception.Response -and $null -ne $Exception.Response.StatusCode) {
        return [int]$Exception.Response.StatusCode
    }

    return $null
}

function Show-ComposeFailureDiagnostics {
    Write-Host "[start-local] docker compose failed. Collecting diagnostics..." -ForegroundColor Yellow

    try {
        & docker compose ps
    } catch {
        Write-Host "[start-local] Failed to run 'docker compose ps'." -ForegroundColor Yellow
    }

    try {
        & docker compose logs --tail 120
    } catch {
        Write-Host "[start-local] Failed to read compose logs." -ForegroundColor Yellow
    }
}

function Get-ContainerRuntimeState {
    param([string]$ContainerName)

    try {
        $state = (& docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $ContainerName 2>$null | Out-String).Trim()
        if ([string]::IsNullOrWhiteSpace($state)) {
            return $null
        }
        return $state
    } catch {
        return $null
    }
}

function Wait-ForStackReadiness {
    param(
        [string]$HealthUrl,
        [int]$TimeoutSeconds,
        [int]$PollIntervalSeconds
    )

    $criticalContainers = @(
        "eventzen-mongo",
        "eventzen-mysql",
        "eventzen-kafka",
        "eventzen-node",
        "eventzen-spring",
        "eventzen-dotnet",
        "eventzen-nginx"
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $badStates = @()

        foreach ($container in $criticalContainers) {
            $state = Get-ContainerRuntimeState -ContainerName $container
            if ($state -in @("unhealthy", "exited", "dead")) {
                $badStates += ("{0}:{1}" -f $container, $state)
            }
        }

        if ($badStates.Count -gt 0) {
            Show-ComposeFailureDiagnostics
            throw "Startup failed. Unhealthy containers detected: $($badStates -join ', ')."
        }

        $gatewayState = Get-ContainerRuntimeState -ContainerName "eventzen-nginx"
        if ($gatewayState -eq "healthy" -or $gatewayState -eq "running") {
            try {
                $null = Invoke-RestMethod -Method Get -Uri $HealthUrl -TimeoutSec 5
                Write-Host "[start-local] Stack is ready. Health check passed at $HealthUrl"
                return
            } catch {
                # Continue polling until timeout.
            }
        }

        Start-Sleep -Seconds $PollIntervalSeconds
    }

    Show-ComposeFailureDiagnostics
    throw "Timed out waiting for stack readiness after $TimeoutSeconds seconds. Last checked health URL: $HealthUrl"
}

$vaultKvUri = "{0}/v1/{1}/data/{2}" -f $VaultAddr.TrimEnd('/'), $vaultKvMount.Trim('/'), $vaultKvPath.Trim('/')
$vaultHeaders = @{ "X-Vault-Token" = $VaultToken }
$localSecrets = $null

if (Test-Path $vaultSecretsFile) {
    try {
        $localSecrets = Get-Content -Path $vaultSecretsFile -Encoding utf8 -Raw | ConvertFrom-Json
    } catch {
        throw "Invalid JSON in '$vaultSecretsFile'. Fix the file before running start-local."
    }

    if ($null -eq $localSecrets) {
        throw "'$vaultSecretsFile' is empty. Add required secrets or remove the file if Vault is already seeded."
    }

    $localSecretKeyCount = @($localSecrets.PSObject.Properties.Name).Count
    if ($localSecretKeyCount -eq 0) {
        throw "'$vaultSecretsFile' has no keys. Add required secrets or remove the file if Vault is already seeded."
    }
}

if ($null -ne $localSecrets) {
    try {
        $uploadBody = @{ data = $localSecrets } | ConvertTo-Json -Depth 100
        $null = Invoke-RestMethod -Method Post -Uri $vaultKvUri -Headers $vaultHeaders -ContentType "application/json" -Body $uploadBody -TimeoutSec 15
        Write-Host "[start-local] Uploaded '$vaultSecretsFile' to Vault path '$vaultKvMount/$vaultKvPath' (new KV version)."
    } catch {
        $statusCode = Get-HttpStatusCode -Exception $_.Exception
        if ($statusCode -eq 401 -or $statusCode -eq 403) {
            throw "Vault auth failed while uploading '$vaultSecretsFile'. Verify VAULT_TOKEN permissions."
        }
        throw "Failed to upload '$vaultSecretsFile' to Vault path '$vaultKvMount/$vaultKvPath'."
    }
} else {
    $vaultPathExists = $false
    try {
        $null = Invoke-RestMethod -Method Get -Uri $vaultKvUri -Headers $vaultHeaders -TimeoutSec 10
        $vaultPathExists = $true
    } catch {
        $statusCode = Get-HttpStatusCode -Exception $_.Exception
        if ($statusCode -eq 404) {
            $vaultPathExists = $false
        } elseif ($statusCode -eq 401 -or $statusCode -eq 403) {
            throw "Vault auth failed while checking '$vaultKvMount/$vaultKvPath'. Verify VAULT_TOKEN permissions."
        } else {
            throw "Failed to check Vault secrets path '$vaultKvMount/$vaultKvPath' at '$VaultAddr'."
        }
    }

    if (-not $vaultPathExists) {
        throw "Vault path '$vaultKvMount/$vaultKvPath' does not exist and '$vaultSecretsFile' was not found. Create vault-secrets.local.json or seed Vault before startup."
    }

    Write-Host "[start-local] Local secrets file not found. Using existing Vault path '$vaultKvMount/$vaultKvPath'."
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

    if ($ComposeRetryCount -lt 0) {
        throw "ComposeRetryCount must be 0 or greater."
    }

    if ($ComposeRetryDelaySeconds -lt 0) {
        throw "ComposeRetryDelaySeconds must be 0 or greater."
    }

    if ($StartupWaitSeconds -le 0) {
        throw "StartupWaitSeconds must be greater than 0."
    }

    if ($StartupPollIntervalSeconds -le 0) {
        throw "StartupPollIntervalSeconds must be greater than 0."
    }

    $maxAttempts = $ComposeRetryCount + 1
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        Write-Host "[start-local] Running: docker $($composeArgs -join ' ') (attempt $attempt/$maxAttempts)"
        & docker @composeArgs

        if ($LASTEXITCODE -eq 0) {
            break
        }

        if ($attempt -lt $maxAttempts) {
            Show-ComposeFailureDiagnostics
            Write-Host "[start-local] Compose failed. Retrying in $ComposeRetryDelaySeconds seconds..." -ForegroundColor Yellow
            Start-Sleep -Seconds $ComposeRetryDelaySeconds
            continue
        }

        Show-ComposeFailureDiagnostics
        throw "docker compose up failed with exit code $LASTEXITCODE"
    }

    if ($Detach) {
        Write-Host "[start-local] Waiting for stack readiness..."
        Wait-ForStackReadiness -HealthUrl $GatewayHealthUrl -TimeoutSeconds $StartupWaitSeconds -PollIntervalSeconds $StartupPollIntervalSeconds
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
