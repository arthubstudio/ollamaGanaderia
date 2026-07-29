# Evidencia 07 - Validacion posterior a la remediacion

Fecha: 2026-07-29

## Alcance

Validacion local y no destructiva del codigo remediado. No se contacto produccion,
Ngrok ni un hostname Cloudflare nuevo. Tampoco se descargo ni construyo el modelo
pesado del reranker.

## Resultados comprobados

| Control | Resultado |
|---|---|
| Pruebas unitarias | 64/64 PASS |
| Build Nuxt/Nitro | PASS |
| TypeScript de scripts | PASS |
| Docker Compose config | PASS |
| `npm audit` | 0 vulnerabilidades |
| Arbol de dependencias | `npm ls --all --silent` PASS |
| Rol PostgreSQL runtime | CRUD PASS; DDL, CREATE ROLE y CREATE DATABASE rechazados |
| Bootstrap PostgreSQL aislado | PASS |
| Cuentas conocidas en base nueva | 0 |
| Administradores creados por seed | 0 |
| Contextos semanticos inseguros | 0 |
| E2E de seguridad | 6/6 PASS |
| E2E de chat IA | 1/1 PASS |
| E2E multiagente | 4/4 PASS |
| E2E de plataforma | 3/3 PASS (Chromium, Firefox y WebKit) |
| E2E de WebSocket Chromium | 1/1 PASS |
| E2E de mejoras Chromium | 2/2 PASS |

## Controles observados en E2E

- Headers CSP, HSTS y `Cache-Control: private, no-store`.
- Cookie v3 `HttpOnly`, `Secure` y `SameSite=Strict` bajo HTTPS confiable.
- Rechazo CSRF/origen, host y rutas internas.
- Revocacion de sesion y rechazo de replay despues de logout.
- Bloqueo de tools IA directas sin confirmacion server-side.
- Limites de body, memoria, peso, login y registro.
- Directorio con correo enmascarado y clave opaca.
- Observabilidad sin prompts, respuestas ni PII crudos.
- Transferencias, chat, deduplicacion, entrega y lectura sin regresion en Chromium.
- Login temporal, respuesta IA, ruteo multiagente, contexto y prompt injection sin cuentas demo.

## Pendientes externos

1. Reiniciar el flujo seguro con `npm run tunnel:serve` y probar un nuevo hostname
   exacto de Cloudflare.
2. Construir y probar el perfil `reranker` cuando se autorice la descarga del
   modelo y de sus dependencias de imagen.
3. Integrar la matriz ya aprobada y un escaneo de imagen/SBOM en CI.
