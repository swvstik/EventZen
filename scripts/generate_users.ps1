param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$lockFile = Join-Path $scriptDir '.generate_users.lock'

if ((Test-Path $lockFile) -and -not $Force) {
  Write-Host 'User generation already completed earlier. Use -Force to run again.' -ForegroundColor Yellow
  exit 0
}

$users = @(
  @{ name = 'Admin User';   email = 'admin@ez.local'; role = 'ADMIN' },
  @{ name = 'Vendor User';  email = 'vendor@ez.local'; role = 'VENDOR' },
  @{ name = 'Regular User'; email = 'user@ez.local'; role = 'CUSTOMER' }
)

$password = 'Eventzen@2026!'

Write-Host 'Generating bcrypt hash in node container...'
$hash = docker exec eventzen-node node -e "const bcrypt=require('bcryptjs');bcrypt.hash(process.argv[1],12).then(h=>console.log(h)).catch(e=>{console.error(e);process.exit(1);});" "$password"
$hash = ($hash | Select-Object -Last 1).Trim()

if ([string]::IsNullOrWhiteSpace($hash)) {
  throw 'Failed to generate password hash.'
}

$usersJson = $users | ConvertTo-Json -Compress

$mongoScriptTemplate = @'
const dbNode = db.getSiblingDB('eventzen_node');
const users = __USERS_JSON__;
const passwordHash = '__PASSWORD_HASH__';
const now = new Date();

users.forEach((u) => {
  dbNode.users.updateOne(
    { email: u.email.toLowerCase() },
    {
      $set: {
        name: u.name,
        role: u.role,
        passwordHash,
        isEmailVerified: true,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
        avatarUrl: null,
        phoneNumber: null,
      },
    },
    { upsert: true }
  );
});

const seeded = dbNode.users.find(
  { email: { $in: users.map((u) => u.email.toLowerCase()) } },
  { _id: 0, email: 1, role: 1, isEmailVerified: 1 }
).toArray();

print(JSON.stringify(seeded));
'@

$mongoScript = $mongoScriptTemplate.Replace('__USERS_JSON__', $usersJson).Replace('__PASSWORD_HASH__', $hash)

Write-Host 'Upserting users in Mongo...'
$result = $mongoScript | docker exec -i eventzen-mongo mongosh --quiet
if ($LASTEXITCODE -ne 0) {
  throw 'Mongo user upsert failed.'
}
Write-Host $result

$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
@(
  "completed_at=$stamp"
  "users=admin@ez.local,vendor@ez.local,user@ez.local"
) | Set-Content -Path $lockFile -Encoding UTF8

Write-Host 'Done. Seeded admin@ez.local, vendor@ez.local, user@ez.local.' -ForegroundColor Green
