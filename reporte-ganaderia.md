# Reporte actualizado de pruebas - Ganaderia AI

Fecha de correccion: 27 de julio de 2026  
Reporte de origen: `C:\Users\hugoa\Downloads\reporte_ganaderia.md`  
Alcance revisado: Nuxt/Nitro, autenticacion, sesiones, IA, observabilidad y exposicion publica.

Actualizacion funcional: se retiro el codigo de invitacion del registro por
solicitud del proyecto. El alta vuelve a solicitar unicamente nombre, correo y
contrasena; conserva validacion, proteccion same-origin y rate limiting.

## Resumen

El reporte original correspondia parcialmente a una version anterior. Por ejemplo,
la observabilidad ya filtraba por la sesion autenticada y el backend ya ignoraba
`usuario_id` enviado por el cliente. Los fallos que seguian presentes eran la falta
de rate limiting, validacion tardia del chat, headers HTTP incompletos, cookie no
marcada como segura detras del tunel, falta de control de origen y exposicion
excesiva de resultados de tools.

Se aplicaron correcciones incrementales. No se cambiaron rutas publicas, tablas,
tools, agentes, PostgreSQL, pgvector, Ollama ni el streaming SSE.

## Problemas, causas y soluciones

| ID | Problema encontrado | Causa real | Solucion aplicada | Estado |
|---|---|---|---|---|
| LOGIN-001 | Login aceptaba `Origin` externo | No existia validacion same-origin para metodos de escritura | Middleware global bloquea `Origin` distinto y `Sec-Fetch-Site: cross-site` antes del endpoint | PASS |
| LOGIN-002 / 015 | Sin limites en login e IA | Los endpoints procesaban todas las solicitudes | Limites por IP, identidad o usuario con respuesta `429`, `Retry-After` y codigo `RATE_LIMITED` | PASS |
| LOGIN-003 | Cookie sin `Secure` en Cloudflare | Solo dependia de `NODE_ENV=production` | La cookie usa el protocolo real o `X-Forwarded-Proto`; HTTPS genera `Secure` | PASS |
| LOGIN-004 / 014 | `conversation_id` malformado producia 500 | PostgreSQL intentaba convertir el texto a UUID antes de validarlo | Validacion UUID compartida previa a cualquier consulta; devuelve `400 INVALID_CONVERSATION_ID` | PASS |
| LOGIN-005 / 029 | Entrada de 5000 caracteres producia 500 | No habia limite previo a embeddings/LLM | Maximo de 4096 caracteres; devuelve `400 FIELD_TOO_LONG` | PASS |
| LOGIN-006 | Headers de seguridad ausentes | No habia middleware HTTP global | Se agregaron CSP, HSTS en HTTPS, `nosniff`, frame protection, Referrer Policy, Permissions Policy, COOP y CORP | PASS |
| LOGIN-007 | Login y APIs sensibles cacheables | No habia politica explicita de cache | `no-store`, `no-cache`, `private`, `Pragma` y `Expires` en auth, IA y observabilidad | PASS |
| LOGIN-008 | Clickjacking | Faltaban `X-Frame-Options` y `frame-ancestors` | `X-Frame-Options: DENY` y CSP `frame-ancestors 'none'` | PASS |
| LOGIN-009 | Diferencia temporal entre usuario existente e inexistente | Un usuario inexistente no ejecutaba scrypt | Verificacion dummy con scrypt para usuarios inexistentes y cuentas legacy | PASS |
| LOGIN-010 | `pregunta` vacia o `null` producia 500 | Se normalizaba antes de validar tipo/contenido | Validacion compartida devuelve `400 REQUIRED_FIELD` | PASS |
| LOGIN-011 | Payload de sesion legible | La cookie anterior solo firmaba JSON en Base64 | Nuevas cookies `v2` cifran el payload con AES-256-GCM; cookies legacy siguen validas solo hasta expirar | PASS |
| LOGIN-012 | Ruta local en assets del servidor dev | Se expuso Vite/Nuxt en modo desarrollo | Sourcemaps y DevTools desactivados; tuneles documentados sobre `build` + `preview` | PASS |
| LOGIN-013 | `X-Powered-By` visible | Header agregado durante el render | Middleware y hook `beforeResponse` lo eliminan | PASS |
| LOGIN-020 / 023 / 034 | Posible observabilidad cross-user | El reporte probo una version que listaba logs sin aislamiento suficiente | Se conserva el filtro por `user:<id>` o conversaciones propias y se agrego una prueba con dos usuarios | PASS |
| LOGIN-021 | Esquema y parametros visibles en tools | Se devolvia el JSON completo de `tools_executed` | La API publica solo entrega `name` y `status`; argumentos/resultados quedan en servidor | PASS |
| LOGIN-022 | Registro publico automatizable | No existe verificacion de correo ni CAPTCHA | Por decision funcional se retiro la invitacion; permanece el limite de 20 registros/hora/IP y la validacion server-side | NO PASS (riesgo conocido) |
| LOGIN-025 | El body podia enviar otro `usuario_id` | Hallazgo interpretaba la cookie como si debiera ligarse al valor del body | Se confirmo que los endpoints usan exclusivamente el usuario de la cookie y no el ID enviado | PASS |

## Limites configurados

| Superficie | Limite |
|---|---|
| Login por IP + email | 5 intentos cada 15 minutos |
| Login general por IP | 30 intentos cada 10 minutos |
| Registro por IP | 20 intentos por hora |
| `/api/ia/chat` | 10 solicitudes por minuto y usuario |
| `/api/ia/router` | 20 solicitudes por minuto y usuario |
| Function Calling | 30 solicitudes por minuto y usuario |
| Evaluador IA | 30 solicitudes por minuto y usuario |

## Archivos creados

- `server/middleware/security.ts`
- `server/plugins/securityHeaders.ts`
- `server/utils/iaRequest.ts`
- `server/utils/rateLimit.ts`
- `server/utils/requestSecurity.ts`
- `tests/securityHardening.test.ts`
- `e2e/security.spec.ts`
- `reporte-ganaderia.md`

## Archivos modificados

- `.env.example`
- `AI_CONTEXT.md`
- `README.md`
- `docs/semana-06-tunel.md`
- `nuxt.config.ts`
- `package.json`
- `pages/login.vue`
- `pages/register.vue`
- `server/api/auth/login.post.ts`
- `server/api/auth/register.post.ts`
- `server/api/ia/chat.post.ts`
- `server/api/ia/evaluate.post.ts`
- `server/api/ia/function-calling.post.ts`
- `server/api/ia/router.post.ts`
- `server/api/observabilidad/index.get.ts`
- `server/utils/session.ts`

## Resultado final de pruebas

| Prueba | Resultado real | Estado |
|---|---|---|
| Suite unitaria completa | 58 pruebas, 58 aprobadas, 0 fallidas | PASS |
| Validacion `pregunta=null` | HTTP 400, `REQUIRED_FIELD` | PASS |
| Validacion de 5000 caracteres | HTTP 400, `FIELD_TOO_LONG` | PASS |
| Validacion `conversation_id=../../etc/passwd` | HTTP 400, `INVALID_CONVERSATION_ID` | PASS |
| Rate limit del chat | Solicitudes 1-10 rechazadas por validacion; solicitud 11 devuelve 429 | PASS |
| Rate limit del login | Intentos 6 y 7 devolvieron 429 en la prueba sin PostgreSQL | PASS |
| CSRF con `Origin: https://evil.example` | HTTP 403, `CROSS_SITE_REQUEST_BLOCKED` | PASS |
| Headers sobre `/login` por HTTPS proxy | Todos los headers configurados estuvieron presentes | PASS |
| `X-Powered-By` | Ausente en la respuesta compilada | PASS |
| Ruta `C:/Users/hugoa` en artefactos servidos | Sin coincidencias fuera de sourcemaps, que estan deshabilitados | PASS |
| `npm run build` | Bundle cliente, servidor y Nitro generado correctamente | PASS |
| `docker compose config --quiet` | Configuracion valida | PASS |
| TypeScript de los archivos nuevos de seguridad | Sin errores en esos archivos | PASS |
| TypeScript global del repositorio | Conserva errores previos de nullabilidad/tipos fuera de esta correccion | NO PASS |
| `npm run test:e2e:security` con PostgreSQL | No ejecutado: Docker estaba detenido y el puerto 5433 no respondia | NO PASS |
| Repeticion contra un Cloudflare Tunnel nuevo | No ejecutada: no habia tunel activo durante la correccion | NO PASS |

## Casos que ya eran PASS

Se conservaron las protecciones previamente aprobadas: SQL/NoSQL injection,
XSS reflejado, command injection, mass assignment, JSON malformado, mensajes de
credenciales genericos, password hash no expuesto, logout, proteccion de endpoints,
CORS, cookie HttpOnly/SameSite, prompt injection, extraccion del system prompt,
exfiltracion RAG, abuso de tools y escalamiento multi-turno. La suite funcional de
IA continuo aprobando todos sus casos despues de los cambios.

## Problemas no verificados o riesgos restantes

- Docker Desktop no estaba iniciado; por ello no fue posible ejecutar el E2E que
  crea dos usuarios y comprueba el aislamiento de observabilidad contra PostgreSQL.
- El rate limiter es local a una instancia de Nitro. Un despliegue horizontal debe
  mover los contadores a PostgreSQL o a otro almacen compartido.
- El alta publica permite registro con nombre, correo y contrasena. El limite por
  IP reduce automatizacion basica, pero sin verificacion de correo ni CAPTCHA el
  abuso distribuido sigue siendo un riesgo conocido.
- La CSP mantiene `unsafe-inline` para la hidratacion SSR de Nuxt. Quitar esa
  directiva exige implementar nonces por respuesta y volver a probar todo el render.
- El typecheck global ya tenia errores de nullabilidad y tipos en modulos no
  relacionados. El build de Nuxt si termino correctamente.
- Debe repetirse `npm run test:e2e:security` y el pentest sobre una URL nueva de
  Cloudflare antes de considerar cerrada la validacion externa.

## Comandos de comprobacion

```bash
npm test
npm run build
docker compose config --quiet
docker compose up -d
npm run test:e2e:security
```

Para el tunel publico:

```bash
npm run tunnel:serve
cloudflared tunnel --url http://localhost:3001
```
