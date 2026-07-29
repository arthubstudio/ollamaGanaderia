param(
  [Parameter(Mandatory = $true)]
  [string]$DatabasePassword,

  [Parameter(Mandatory = $true)]
  [string]$SessionSecret,

  [string]$DatabaseUser = "ganaderia_security_audit",
  [string]$DatabaseName = "ganaderia_ai_security_test"
)

$ErrorActionPreference = "Stop"

if ($DatabaseName -ne "ganaderia_ai_security_test") {
  throw "The audit production server only permits ganaderia_ai_security_test."
}

if ($SessionSecret.Length -lt 32) {
  throw "SessionSecret must contain at least 32 characters."
}

$appRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$encodedPassword = [System.Uri]::EscapeDataString($DatabasePassword)
$env:DATABASE_URL = "postgres://${DatabaseUser}:${encodedPassword}@127.0.0.1:55433/${DatabaseName}"
$env:NUXT_SESSION_SECRET = $SessionSecret
$env:OLLAMA_HOST = "http://127.0.0.1:11435"
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11435"
$env:RERANKER_URL = "http://127.0.0.1:18010/rerank"
$env:NODE_ENV = "production"
$env:HOST = "127.0.0.1"
$env:PORT = "3202"

Push-Location $appRoot
try {
  & node .output/server/index.mjs
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
