param(
  [Parameter(Mandatory = $true)]
  [string]$DatabasePassword,

  [string]$DatabaseUser = "ganaderia_security_audit",
  [string]$DatabaseName = "ganaderia_ai_security_test"
)

$ErrorActionPreference = "Stop"

if ($DatabaseName -ne "ganaderia_ai_security_test") {
  throw "The audit runner only permits ganaderia_ai_security_test."
}

$appRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$env:SECURITY_BASE_URL = "http://127.0.0.1:3201"
$encodedPassword = [System.Uri]::EscapeDataString($DatabasePassword)
$env:SECURITY_DATABASE_URL = "postgres://${DatabaseUser}:${encodedPassword}@127.0.0.1:55433/${DatabaseName}"

Push-Location $appRoot
try {
  & node security-audit/scripts/dynamic-security-tests.mjs
  exit $LASTEXITCODE
} finally {
  Remove-Item Env:SECURITY_DATABASE_URL -ErrorAction SilentlyContinue
  Pop-Location
}
