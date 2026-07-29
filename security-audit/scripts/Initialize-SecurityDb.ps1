param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUser,

  [Parameter(Mandatory = $true)]
  [string]$DatabasePassword,

  [string]$DatabaseName = "ganaderia_ai_security_test",
  [int]$Port = 55433
)

$ErrorActionPreference = "Stop"

if ($DatabaseName -ne "ganaderia_ai_security_test") {
  throw "The audit script only permits ganaderia_ai_security_test."
}

if ($Port -ne 55433) {
  throw "The audit script only permits the loopback test port 55433."
}

$auditRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $auditRoot "docker-compose.security.yml"
$env:SECURITY_DB_USER = $DatabaseUser
$env:SECURITY_DB_PASSWORD = $DatabasePassword
$env:SECURITY_DB_NAME = $DatabaseName
$env:SECURITY_DB_PORT = [string]$Port

docker compose --project-name ganaderia-security --file $composeFile up -d --pull never
if ($LASTEXITCODE -ne 0) {
  throw "Could not start the isolated PostgreSQL container."
}

$healthy = $false
for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
  $status = docker inspect --format "{{.State.Health.Status}}" ganaderia_security_db 2>$null
  if ($status -eq "healthy") {
    $healthy = $true
    break
  }
  Start-Sleep -Seconds 2
}

if (-not $healthy) {
  throw "The isolated PostgreSQL container did not become healthy."
}

$seedPath = Join-Path (Split-Path -Parent $auditRoot) "database/seeds.sql"
$seedSql = Get-Content -LiteralPath $seedPath -Raw
$semanticInsertMarker = "INSERT INTO semantic_contexts (bovino_id, contenido, updated_at)"
$sequenceRepair = @"
SELECT setval(
  'semantic_contexts_id_seq',
  COALESCE((SELECT MAX(id) FROM semantic_contexts), 1),
  true
);
"@

if (-not $seedSql.Contains($semanticInsertMarker)) {
  throw "Could not locate the semantic context insert marker in database/seeds.sql."
}

# Audit-only compatibility shim. The production seed currently inserts explicit
# IDs without advancing semantic_contexts_id_seq, so its next implicit ID fails.
$seedSql = $seedSql.Replace(
  $semanticInsertMarker,
  "$sequenceRepair`r`n$semanticInsertMarker"
)
$seedSql | docker exec -i ganaderia_security_db psql `
  -v ON_ERROR_STOP=1 `
  -U $DatabaseUser `
  -d $DatabaseName

if ($LASTEXITCODE -ne 0) {
  throw "Database initialization failed for database/seeds.sql."
}

$sqlFiles = @(
  "/audit-source/004-platform.sql",
  "/audit-source/005-relations.sql",
  "/audit-source/006-websocket.sql",
  "/audit-source/007-security.sql",
  "/audit-source/900-reset-security-data.sql"
)

foreach ($sqlFile in $sqlFiles) {
  docker exec ganaderia_security_db psql `
    -v ON_ERROR_STOP=1 `
    -U $DatabaseUser `
    -d $DatabaseName `
    -f $sqlFile

  if ($LASTEXITCODE -ne 0) {
    throw "Database initialization failed for $sqlFile."
  }
}

Write-Output "Isolated audit database initialized on 127.0.0.1:55433."
