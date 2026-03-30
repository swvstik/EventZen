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
    [switch]$KeepWrappedToken,
    [switch]$SkipPortAutoResolve
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

function Get-EnvValue {
    param(
        [string[]]$Lines,
        [string]$Key
    )

    foreach ($line in $Lines) {
        if ($line -match ("^{0}=" -f [regex]::Escape($Key))) {
            return $line.Substring($Key.Length + 1)
        }
    }

    return $null
}

function Set-EnvValue {
    param(
        [string[]]$Lines,
        [string]$Key,
        [string]$Value
    )

    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match ("^{0}=" -f [regex]::Escape($Key))) {
            $Lines[$i] = ("{0}={1}" -f $Key, $Value)
            return ,$Lines
        }
    }

    return ,($Lines + ("{0}={1}" -f $Key, $Value))
}

function Test-PortAvailable {
    param([int]$Port)

    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($null -ne $listener) {
            try { $listener.Stop() } catch {}
        }
    }
}

function Find-NextAvailablePort {
    param([int]$StartPort)

    $candidate = [Math]::Max($StartPort, 1024)
    while ($candidate -le 65535) {
        if (Test-PortAvailable -Port $candidate) {
            return $candidate
        }
        $candidate++
    }

    return $null
}

function Get-EventZenBoundHostPorts {
    $bound = @{}

    try {
        $rows = & docker ps --format "{{.Names}}|{{.Ports}}" 2>$null
    } catch {
        return $bound
    }

    foreach ($row in $rows) {
        if ([string]::IsNullOrWhiteSpace($row)) {
            continue
        }

        $parts = $row.Split("|", 2)
        if ($parts.Count -ne 2) {
            continue
        }

        $name = $parts[0]
        $ports = $parts[1]
        if (-not $name.StartsWith("eventzen-")) {
            continue
        }

        $matches = [regex]::Matches($ports, ":(\d+)->")
        foreach ($match in $matches) {
            $hostPort = 0
            if ([int]::TryParse($match.Groups[1].Value, [ref]$hostPort)) {
                $bound[$hostPort] = $true
            }
        }
    }

    return $bound
}

function Resolve-ComposeHostPorts {
    param([string]$EnvPath)

    $trackedPortDefaults = [ordered]@{
        GATEWAY_HOST_PORT = 8080
        MONGO_HOST_PORT = 27018
        MYSQL_HOST_PORT = 3307
        MINIO_API_HOST_PORT = 9000
        MINIO_CONSOLE_HOST_PORT = 9001
        KAFKA_HOST_PORT = 9094
        PROMETHEUS_HOST_PORT = 9090
        GRAFANA_HOST_PORT = 3000
    }

    $lines = Get-Content -Path $EnvPath -Encoding utf8
    $changes = @()
    $eventZenBoundPorts = Get-EventZenBoundHostPorts
    $claimedPorts = @{}

    foreach ($key in $trackedPortDefaults.Keys) {
        $raw = Get-EnvValue -Lines $lines -Key $key
        if ([string]::IsNullOrWhiteSpace($raw)) {
            $raw = [string]$trackedPortDefaults[$key]
        }

        $port = 0
        if (-not [int]::TryParse($raw, [ref]$port)) {
            Write-Host "[start-local] Skipping port auto-resolve for '$key' (non-numeric value '$raw')." -ForegroundColor Yellow
            continue
        }

        if ($port -lt 1 -or $port -gt 65535) {
            Write-Host "[start-local] Skipping port auto-resolve for '$key' (out-of-range value '$raw')." -ForegroundColor Yellow
            continue
        }

        $portConflict = -not (Test-PortAvailable -Port $port)
        $duplicateConflict = $claimedPorts.ContainsKey($port)

        if (-not $portConflict -and -not $duplicateConflict) {
            $claimedPorts[$port] = $true
            continue
        }

        if ($portConflict -and $eventZenBoundPorts.ContainsKey($port)) {
            $claimedPorts[$port] = $true
            continue
        }

        $newPort = Find-NextAvailablePort -StartPort ($port + 1)
        if ($null -eq $newPort) {
            throw "Unable to find a free host port to replace '$key=$port'."
        }

        while ($claimedPorts.ContainsKey($newPort)) {
            $newPort = Find-NextAvailablePort -StartPort ($newPort + 1)
            if ($null -eq $newPort) {
                throw "Unable to find a unique free host port to replace '$key=$port'."
            }
        }

        $lines = Set-EnvValue -Lines $lines -Key $key -Value ([string]$newPort)
        $claimedPorts[$newPort] = $true
        $changes += ("{0}: {1} -> {2}" -f $key, $port, $newPort)

        if ($key -eq "GATEWAY_HOST_PORT") {
            $oldGatewayUrl = ("http://localhost:{0}" -f $port)
            $newGatewayUrl = ("http://localhost:{0}" -f $newPort)

            $lines = Set-EnvValue -Lines $lines -Key "GATEWAY_HEALTH_URL" -Value ("http://localhost:{0}/health" -f $newPort)

            $clientUrl = Get-EnvValue -Lines $lines -Key "CLIENT_URL"
            if (-not [string]::IsNullOrWhiteSpace($clientUrl)) {
                $updatedClientUrl = $clientUrl.Replace($oldGatewayUrl, $newGatewayUrl)
                $lines = Set-EnvValue -Lines $lines -Key "CLIENT_URL" -Value $updatedClientUrl
            }

            $corsOrigins = Get-EnvValue -Lines $lines -Key "CORS_ALLOWED_ORIGINS"
            if (-not [string]::IsNullOrWhiteSpace($corsOrigins)) {
                $updatedCors = (($corsOrigins -split ",") | ForEach-Object {
                    $origin = $_.Trim()
                    if ($origin -eq $oldGatewayUrl) {
                        return $newGatewayUrl
                    }
                    return $origin
                }) -join ","
                $lines = Set-EnvValue -Lines $lines -Key "CORS_ALLOWED_ORIGINS" -Value $updatedCors
            }

            $minioPublic = Get-EnvValue -Lines $lines -Key "MINIO_PUBLIC_BASE_URL"
            if (-not [string]::IsNullOrWhiteSpace($minioPublic)) {
                $updatedMinioPublic = $minioPublic.Replace($oldGatewayUrl, $newGatewayUrl)
                $lines = Set-EnvValue -Lines $lines -Key "MINIO_PUBLIC_BASE_URL" -Value $updatedMinioPublic
            }
        }
    }

    if ($changes.Count -gt 0) {
        Set-Content -Path $EnvPath -Encoding utf8 -Value $lines
        Write-Host "[start-local] Port conflicts detected. Updated .env mappings:" -ForegroundColor Yellow
        foreach ($change in $changes) {
            Write-Host "[start-local]   $change" -ForegroundColor Yellow
        }
    }

    return (Get-EnvValue -Lines $lines -Key "GATEWAY_HEALTH_URL")
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

function New-WrappedVaultSecretId {
    param(
        [string]$Address,
        [string]$Token,
        [string]$PolicyName,
        [string]$WrapTtlValue
    )

    $headers = @{
        "X-Vault-Token" = $Token
        "X-Vault-Wrap-TTL" = $WrapTtlValue
    }
    $body = @{
        policies = @($PolicyName)
        ttl = "1h"
    }

    try {
        $resp = Invoke-RestMethod -Method Post -Uri ("{0}/v1/auth/token/create" -f $Address.TrimEnd('/')) -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json)
    } catch {
        throw "Failed to generate wrapped token from Vault. Check VAULT_TOKEN and policy permissions."
    }

    $wrappedToken = $resp.wrap_info.token
    if ([string]::IsNullOrWhiteSpace($wrappedToken)) {
        throw "Vault did not return wrap_info.token."
    }

    return $wrappedToken
}

function Set-EnvWrappedToken {
    param(
        [string]$EnvFilePath,
        [string]$WrappedToken
    )

    $envLines = Get-Content -Path $EnvFilePath -Encoding utf8
    $updated = $false
    for ($i = 0; $i -lt $envLines.Count; $i++) {
        if ($envLines[$i] -match '^VAULT_WRAPPED_SECRET_ID=') {
            $envLines[$i] = "VAULT_WRAPPED_SECRET_ID=$WrappedToken"
            $updated = $true
            break
        }
    }

    if (-not $updated) {
        $envLines += "VAULT_WRAPPED_SECRET_ID=$WrappedToken"
    }

    Set-Content -Path $EnvFilePath -Value $envLines -Encoding utf8
}

if (-not $SkipPortAutoResolve) {
    $resolvedGatewayHealth = Resolve-ComposeHostPorts -EnvPath $envFile
    if (-not $PSBoundParameters.ContainsKey("GatewayHealthUrl") -and -not [string]::IsNullOrWhiteSpace($resolvedGatewayHealth)) {
        $GatewayHealthUrl = $resolvedGatewayHealth
    }
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
        $wrappedToken = New-WrappedVaultSecretId -Address $VaultAddr -Token $VaultToken -PolicyName $Policy -WrapTtlValue $WrapTtl
        Set-EnvWrappedToken -EnvFilePath $envFile -WrappedToken $wrappedToken
        Write-Host "[start-local] Generated fresh wrapped token for compose attempt $attempt/$maxAttempts"

        Write-Host "[start-local] Running: docker $($composeArgs -join ' ') (attempt $attempt/$maxAttempts)"
        & docker @composeArgs
        $composeExitCode = $LASTEXITCODE

        if ($composeExitCode -eq 0) {
            break
        }

        if ($attempt -lt $maxAttempts) {
            Show-ComposeFailureDiagnostics
            Write-Host "[start-local] Compose failed (exit $composeExitCode). Retrying in $ComposeRetryDelaySeconds seconds..." -ForegroundColor Yellow
            Start-Sleep -Seconds $ComposeRetryDelaySeconds
            continue
        }

        Show-ComposeFailureDiagnostics
        throw "docker compose up failed with exit code $composeExitCode"
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
