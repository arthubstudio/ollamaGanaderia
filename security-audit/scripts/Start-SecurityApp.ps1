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
  throw "The audit app only permits ganaderia_ai_security_test."
}

if ($SessionSecret.Length -lt 32) {
  throw "SessionSecret must contain at least 32 characters."
}

$appRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$env:DATABASE_URL = "postgres://${DatabaseUser}:${DatabasePassword}@127.0.0.1:55433/${DatabaseName}"
$env:NUXT_SESSION_SECRET = $SessionSecret
$env:OLLAMA_HOST = "http://127.0.0.1:11435"
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11435"
$env:RERANKER_URL = "http://127.0.0.1:18010/rerank"
$env:HOST = "127.0.0.1"
$env:PORT = "3201"

Push-Location $appRoot
try {
  & npm.cmd run dev -- --host 127.0.0.1 --port 3201
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
