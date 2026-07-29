# Evidencia de analisis estatico

## Arquitectura

- Nuxt 4, Vue 3, Nitro y Vite.
- PostgreSQL 16 con pgvector.
- Drizzle ORM y SQL parametrizado con `postgres`.
- Ollama local, RAG hibrido, memoria, agentes y function calling.
- WebSocket comunitario y endpoints SSE.
- Docker Compose para PostgreSQL, Ollama y reranker opcional.

## Inventario

- 93 archivos API con sufijo HTTP.
- 28 modulos de tools registrados adicionalmente por Nitro como rutas `ANY`.
- 1 ruta WebSocket.
- Total: 122 superficies.
- Inventario completo: `security-audit/test-results/endpoint-inventory.md`.

## Secretos

- `.env` no esta versionado.
- El historial Git consultado no contiene commits de `.env`.
- No se encontraron claves privadas en el arbol fuente revisado.
- `.env.example`, Compose y README contienen placeholders o credenciales de prueba.
- `database/seeds.sql` contiene cuentas privilegiadas de demostracion con claves
  conocidas; los valores exactos se omiten de toda evidencia de auditoria.

## Controles positivos observados

- Cookies cifradas con AES-256-GCM, `HttpOnly` y `SameSite=Strict`.
- Passwords nuevas con scrypt y comparacion con ruta dummy.
- Respuestas genericas de login y registro duplicado.
- Rate limiting persistente en PostgreSQL.
- Consultas parametrizadas y filtros de pertenencia en los CRUD principales.
- CSP estricta en produccion, frame denial, nosniff, COOP/CORP y Permissions Policy.
- Source maps publicos desactivados.
- Guardrails de prompt injection y contexto RAG marcado como no confiable.
- WebSocket con sesion y comprobacion de participantes.

## Superficies que requieren remediacion

- Semillas con cuentas admin conocidas.
- Sesiones sin revocacion server-side.
- Tools ubicadas bajo `server/api` aunque son modulos internos.
- Confianza directa en cabeceras reenviadas.
- Logs IA con contenido completo.
- Contextos semanticos sin bovino tratados como globales.
- Imagenes y dependencias sin pinning reproducible completo.
