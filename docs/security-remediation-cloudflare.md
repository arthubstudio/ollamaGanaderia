# Remediacion de seguridad - Ganaderia AI y Cloudflare

Fecha de aplicacion inicial: 2026-07-27

Ampliacion de remediacion y validacion local: 2026-07-29

Documento de origen: `security-report-ganaderia-ia-cloudflare.md`.

## Cambios aplicados

| Hallazgo | Estado | Remediacion |
|---|---|---|
| C-01 Vite HMR publico | Corregido | Vite acepta solo hosts loopback. El tunel usa el servidor Nitro de produccion mediante `npm run tunnel:serve`. |
| C-02 acceso Vite `@fs` | Corregido | El servidor de desarrollo no se expone; produccion no incluye rutas `@fs` ni sourcemaps. |
| C-03 credenciales PostgreSQL | Corregido | Se eliminaron fallbacks y clientes con contrasenas embebidas. `DATABASE_URL` y Compose requieren variables de `.env`; la credencial local fue rotada. |
| C-04 bypass CSRF | Corregido | Todo metodo mutable exige `Origin` o `Referer` valido y del mismo origen. Una fuente ausente, invalida o externa recibe `403`. |
| A-01 enumeracion en registro | Mitigado | Alta y correo existente devuelven el mismo estado y cuerpo. El limite por IP es persistente. El formulario sigue usando solo nombre, correo y contrasena. |
| A-02 prompt injection | Corregido | Guardrails comunes protegen router, evaluador, chat RAG y Function Calling antes de usar Ollama, embeddings o tools. Los prompts especializados prohiben revelar configuracion interna. |
| A-03 historial IA expuesto | Corregido | Usuarios normales solo reciben sus metricas y campos sensibles redactados. Los detalles quedan restringidos al rol `admin` y las tools se sanitizan. |
| A-04 API sin limite global | Corregido | Middleware global aplica limites separados de lectura y escritura por usuario autenticado o IP. |
| M-01 rate limit en memoria | Corregido | Los contadores operativos viven en `security_rate_limits` con actualizacion atomica en PostgreSQL. |
| M-02 cookie `SameSite=Lax` | Corregido | La cookie de sesion usa `HttpOnly`, `SameSite=Strict` y `Secure` bajo HTTPS. |
| M-03 modo desarrollo publico | Corregido | El procedimiento documentado de Cloudflare y Ngrok compila y sirve produccion. |
| B-01 rutas Windows expuestas | Corregido | Sourcemaps cliente/servidor estan desactivados y el manejador de errores devuelve mensajes genericos sin stack ni rutas. |
| B-02 CSP permisiva | Corregido | Produccion elimina `unsafe-inline` y `unsafe-eval`; los scripts inline de Nuxt se autorizan con hashes SHA-256 por respuesta. |

La auditoria integral posterior tambien corrigio cuentas conocidas en seeds,
sesiones no revocables, rol PostgreSQL superusuario, tools IA publicas, privacidad
de transferencias/RAG/logs, limites WebSocket/SSE y dependencias vulnerables. La
matriz completa `SEC-001` a `SEC-024` esta en
`security-audit/SECURITY_AUDIT_GANADERIA.md`.

## Migracion

Para un volumen PostgreSQL existente:

```bash
npm run db:migrate:security
npm run db:migrate:security-remediation
npm run db:migrate:account-security
npm run db:runtime:configure
npm run db:runtime:verify
```

Las migraciones `007`, `008` y `009` son aditivas e idempotentes. La `009`
bloquea especificamente las cuentas legacy con credenciales publicadas; no borra
usuarios ni datos de negocio.

## Publicacion segura

Para un Quick Tunnel con subdominio temporal ejecuta:

```bash
npm run tunnel:quick
```

El orquestador detecta la URL generada e inyecta el hostname exacto solo durante
esa ejecucion. No modifica `.env`, no permite otros subdominios y detiene Nitro
cuando se cierra Cloudflare Tunnel.

Para un hostname estable o un arranque manual, configura el hostname exacto en
`.env`:

```env
NUXT_PUBLIC_APP_ORIGIN=https://HOST-EXACTO.trycloudflare.com
NUXT_ALLOWED_HOSTS=HOST-EXACTO.trycloudflare.com
NUXT_TRUST_PROXY=loopback
```

Despues inicia Nitro en otra terminal:

```bash
npm run tunnel:serve
```

No se debe tunelizar `npm run dev`. El puerto `3001` separa el servidor Nitro
publicable del servidor Vite local en `3000`.

## Verificaciones ejecutadas

- Suite unitaria: 64 pruebas aprobadas.
- Build Nuxt/Nitro de produccion: aprobado.
- `npm audit`: 0 vulnerabilidades; `npm ls --all`: aprobado.
- `docker compose config --quiet`: aprobado.
- Bootstrap PostgreSQL aislado y rol runtime sin privilegios: aprobados.
- CSP de `/login`: hashes SHA-256 presentes, sin `unsafe-inline` ni `unsafe-eval`.
- POST sin `Origin`/`Referer`: `403 CROSS_SITE_REQUEST_BLOCKED`.
- POST con origen externo: `403 CROSS_SITE_REQUEST_BLOCKED`.
- Registro repetido: mismo estado `202` y mismo cuerpo.
- Cookie HTTPS: `HttpOnly`, `Secure` y `SameSite=Strict`.
- Prompt injection reportado: bloqueado antes de consultar Ollama.
- Observabilidad de usuario normal: contenido sensible redactado.
- E2E de seguridad: 6/6; WebSocket: 1/1; mejoras: 2/2 en Chromium.
- `npm run tunnel:quick:check`: detector de URL temporal aprobado.
- Quick Tunnel nuevo: Nitro inicio en loopback y `/login` respondio HTTP 200 tanto
  mediante el hostname reenviado como desde la URL HTTPS publica. El tunel se
  cerro al terminar la prueba.
- E2E de plataforma: 3/3 en Chromium, Firefox y WebKit.
- E2E de chat IA: 1/1 y multiagente: 4/4 en Chromium, usando cuentas temporales robustas.

## Riesgo residual

El registro sigue siendo publico por requisito funcional y no verifica la
propiedad del correo. La enumeracion por respuesta queda cerrada y existe
limitacion persistente, pero una publicacion permanente deberia agregar
verificacion de email o aprobacion administrativa sin cambiar los tres campos
del formulario.

El bloqueo de hostname dinamico ya fue comprobado con un Quick Tunnel nuevo.
Falta repetir la matriz externa completa de redirect, HSTS, CSP, cookies,
WebSocket y ausencia de rutas Vite, ademas de construir el perfil opcional del
reranker. Por eso el resultado posterior se documenta como 94/100 provisional,
no como 100/100.
