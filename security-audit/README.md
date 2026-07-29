# Auditoria defensiva de Ganaderia AI

Esta carpeta reproduce la auditoria local sin tocar la base de desarrollo. Los
runners locales rechazan targets distintos de loopback y usan identidades
`.example.test`. El runner de Cloudflare esta bloqueado al unico hostname temporal
que el propietario autorizo expresamente.

## Requisitos

- Windows PowerShell.
- Node.js y dependencias instaladas con `npm install`.
- Docker Desktop.
- Imagen local `pgvector/pgvector:pg16`.
- Ollama local en `127.0.0.1:11435` para las pruebas RAG.

No se descargan imagenes ni modelos. La fase inicial solo permitio `npm audit`
contra el registry npm. Una autorizacion posterior habilito exclusivamente
`reviewing-outcome-barn-andrews.trycloudflare.com` para la validacion del tunel.

## Preparar la base aislada

Define una credencial temporal que no reutilices en ningun entorno:

```powershell
$dbUser = "ganaderia_security_audit"
$dbPassword = Read-Host "Password temporal de auditoria"
./security-audit/scripts/Initialize-SecurityDb.ps1 `
  -DatabaseUser $dbUser `
  -DatabasePassword $dbPassword
```

El script solo acepta `ganaderia_ai_security_test` y el puerto `55433`. Incluye
un shim de secuencia porque el seed productivo falla en una base vacia; no edita
el seed original.

## Iniciar la aplicacion aislada

En otra terminal:

```powershell
$sessionSecret = -join ((1..64) | ForEach-Object { [char](Get-Random -Minimum 97 -Maximum 123) })
./security-audit/scripts/Start-SecurityApp.ps1 `
  -DatabasePassword $dbPassword `
  -SessionSecret $sessionSecret
```

El unico destino permitido es `http://127.0.0.1:3201`.

## Ejecutar las pruebas

```powershell
./security-audit/scripts/Run-DynamicSecurityTests.ps1 -DatabasePassword $dbPassword
node security-audit/scripts/websocket-security-test.mjs
node security-audit/scripts/inventory-endpoints.mjs
npm test
npm run typecheck:scripts
npm run build
docker compose config --quiet
npm audit --json
npm audit --omit=dev --json
```

`dynamic-security-tests.mjs` trunca datos solamente despues de confirmar que la
base se llama exactamente `ganaderia_ai_security_test` y esta en
`127.0.0.1:55433`.

## Validar el tunel autorizado

El script contiene una allowlist fija para el hostname autorizado. Las credenciales
se reciben solo por variables de entorno y no se escriben en el resultado:

```powershell
$env:TUNNEL_TEST_EMAIL = Read-Host "Email de la cuenta de prueba"
$env:TUNNEL_TEST_PASSWORD = Read-Host "Password de prueba"
node security-audit/scripts/cloudflare-tunnel-security-test.mjs
Remove-Item Env:TUNNEL_TEST_EMAIL
Remove-Item Env:TUNNEL_TEST_PASSWORD
```

El script no crea ni elimina registros. El login modifica contadores normales y el
handshake WebSocket puede marcar mensajes pendientes como entregados. El hostname es
temporal; para otro tunel se requiere una nueva autorizacion y una nueva allowlist.

## Limpiar

Para borrar solo los datos sinteticos y conservar el contenedor:

```powershell
docker exec ganaderia_security_db psql `
  -v ON_ERROR_STOP=1 `
  -U ganaderia_security_audit `
  -d ganaderia_ai_security_test `
  -f /audit-source/900-reset-security-data.sql
```

Para eliminar el entorno aislado completo, incluido su volumen:

```powershell
$env:SECURITY_DB_USER = "ganaderia_security_audit"
$env:SECURITY_DB_PASSWORD = $dbPassword
docker compose --project-name ganaderia-security `
  --file security-audit/docker-compose.security.yml down --volumes
```

Verifica siempre que el proyecto Compose sea `ganaderia-security` antes de usar
`--volumes`.

## Pruebas omitidas

- No se contacto produccion. Solo se probo el tunel temporal autorizado.
- No se hicieron ataques de carga, fuerza bruta, flooding WebSocket ni DoS.
- No se inicio el reranker porque puede descargar un modelo externo pesado.
- No se ejecuto E2E visual completo tras observar que SSR intentaba resolver
  iconos en Iconify; WebSocket se valido con un cliente local sin renderizar UI.
- HSTS, TLS, cookies y WebSocket se validaron a traves de Cloudflare.
- No se aplicaron correcciones: esta carpeta corresponde a la fase de reporte.
