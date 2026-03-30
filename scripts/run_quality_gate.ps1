param(
  [switch]$WithKafkaIntegration = $true,
  [string]$KafkaBootstrapServers = 'localhost:9094',
  [int]$KafkaHealthTimeoutSeconds = 60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$results = [System.Collections.Generic.List[object]]::new()

function Add-Result {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Details
  )

  $results.Add([pscustomobject]@{
      Step    = $Name
      Passed  = $Passed
      Details = $Details
    })
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host "\n=== $Name ===" -ForegroundColor Cyan
  try {
    & $Action
    Add-Result -Name $Name -Passed $true -Details 'OK'
  }
  catch {
    Add-Result -Name $Name -Passed $false -Details $_.Exception.Message
    Write-Host "Step failed: $Name" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
  }
}

function Invoke-Cmd {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$Arguments = @(),
    [string]$WorkingDirectory = $repoRoot,
    [hashtable]$Environment = @{}
  )

  Push-Location $WorkingDirectory
  try {
    foreach ($pair in $Environment.GetEnumerator()) {
      Set-Item -Path "Env:$($pair.Key)" -Value $pair.Value
    }

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
    }
  }
  finally {
    foreach ($pair in $Environment.GetEnumerator()) {
      Remove-Item -Path "Env:$($pair.Key)" -ErrorAction SilentlyContinue
    }
    Pop-Location
  }
}

function Wait-ForKafkaHealth {
  param(
    [int]$TimeoutSeconds
  )

  Invoke-Cmd -FilePath 'docker' -Arguments @('compose', 'up', '-d', 'kafka') -WorkingDirectory $repoRoot

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $containerId = (& docker compose -f (Join-Path $repoRoot 'docker-compose.yml') ps -q kafka).Trim()
    if (-not [string]::IsNullOrWhiteSpace($containerId)) {
      $health = (& docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $containerId).Trim()
      if ($health -eq 'healthy' -or $health -eq 'running') {
        return
      }
    }

    Start-Sleep -Seconds 2
  }

  throw "Kafka container did not become healthy within $TimeoutSeconds seconds."
}

Write-Host 'EventZen Quality Gate' -ForegroundColor Green
Write-Host "Repo root: $repoRoot"
Write-Host "Kafka integration enabled: $WithKafkaIntegration"

if ($WithKafkaIntegration) {
  Invoke-Step -Name 'Kafka health check' -Action {
    Wait-ForKafkaHealth -TimeoutSeconds $KafkaHealthTimeoutSeconds
  }
}

Invoke-Step -Name 'Node unit tests' -Action {
  Invoke-Cmd -FilePath 'npm' -Arguments @('run', 'test:coverage') -WorkingDirectory (Join-Path $repoRoot 'server/backend-node')
}

if ($WithKafkaIntegration) {
  Invoke-Step -Name 'Node Kafka integration tests' -Action {
    Invoke-Cmd -FilePath 'npm' -Arguments @('run', 'test:integration') -WorkingDirectory (Join-Path $repoRoot 'server/backend-node') -Environment @{
      RUN_KAFKA_INTEGRATION = 'true'
      KAFKA_BOOTSTRAP_SERVERS = $KafkaBootstrapServers
    }
  }
}

Invoke-Step -Name 'Spring tests' -Action {
  $envMap = @{}
  if ($WithKafkaIntegration) {
    $envMap.RUN_KAFKA_INTEGRATION = 'true'
    $envMap.KAFKA_BOOTSTRAP_SERVERS = $KafkaBootstrapServers
  }

  Invoke-Cmd -FilePath 'mvn' -Arguments @('verify') -WorkingDirectory (Join-Path $repoRoot 'server/backend-spring') -Environment $envMap
}

Invoke-Step -Name '.NET tests' -Action {
  $envMap = @{}
  if ($WithKafkaIntegration) {
    $envMap.RUN_KAFKA_INTEGRATION = 'true'
    $envMap.KAFKA_BOOTSTRAP_SERVERS = $KafkaBootstrapServers
  }

  Invoke-Cmd -FilePath 'dotnet' -Arguments @(
    'test',
    'EventZen.Budget.Tests/EventZen.Budget.Tests.csproj',
    '/p:CollectCoverage=true',
    '/p:CoverletOutputFormat=cobertura',
    '/p:Threshold=5',
    '/p:ThresholdType=line',
    '/p:ThresholdStat=total'
  ) -WorkingDirectory (Join-Path $repoRoot 'server/backend-dotnet') -Environment $envMap
}

Invoke-Step -Name 'Client lint' -Action {
  Invoke-Cmd -FilePath 'npm' -Arguments @('run', 'lint', '--', '--max-warnings=0') -WorkingDirectory (Join-Path $repoRoot 'client')
}

Invoke-Step -Name 'Client production build' -Action {
  Invoke-Cmd -FilePath 'npm' -Arguments @('run', 'build') -WorkingDirectory (Join-Path $repoRoot 'client')
}

Write-Host "\n=== Summary ===" -ForegroundColor Cyan
$results | ForEach-Object {
  $status = if ($_.Passed) { 'PASS' } else { 'FAIL' }
  $color = if ($_.Passed) { 'Green' } else { 'Red' }
  Write-Host ("[{0}] {1} - {2}" -f $status, $_.Step, $_.Details) -ForegroundColor $color
}

$failedCount = @($results | Where-Object { -not $_.Passed }).Count
if ($failedCount -gt 0) {
  throw "Quality gate failed. Failed steps: $failedCount"
}

Write-Host "\nQuality gate passed." -ForegroundColor Green