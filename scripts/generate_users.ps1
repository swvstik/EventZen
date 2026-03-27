$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

Push-Location $repoRoot
try {
  Write-Host 'Running compose user seeder (idempotent upsert)...' -ForegroundColor Cyan
  docker compose run --rm user-seed

  if ($LASTEXITCODE -ne 0) {
    throw 'User seeding failed via compose service user-seed.'
  }

  Write-Host 'Done. Seeded admin@ez.local, vendor@ez.local, user@ez.local.' -ForegroundColor Green
}
finally {
  Pop-Location
}
