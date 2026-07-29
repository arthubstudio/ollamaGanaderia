# Evidencia 06: validación autorizada de Cloudflare Tunnel

## Alcance

- Host autorizado: `reviewing-outcome-barn-andrews.trycloudflare.com`.
- Fecha UTC: `2026-07-29T17:18:15Z`.
- Intensidad: 18 solicitudes o secuencias defensivas, sin flooding ni fuerza bruta.
- No se contactaron otros hosts, producción ni servicios de terceros.
- Se usó una cuenta de prueba existente para validar sesión y WebSocket.
- No se guardaron credenciales ni tokens y no se crearon o eliminaron registros de negocio.
- El login actualiza contadores normales de autenticación y abrir WebSocket puede marcar
  mensajes pendientes como entregados mediante el comportamiento normal de la aplicación.

## Resultado

| Resultado | Cantidad |
|---|---:|
| PASS | 13 |
| FAIL de control | 5 |
| Error del runner | 0 |
| Total | 18 |

Controles aprobados:

- Certificado válido y TLS 1.3.
- `/login` responde 200 sin bloqueo de host y pasa por Cloudflare.
- HSTS, `frame-ancestors`, `X-Frame-Options`, `nosniff`, COOP, CORP y política de caché.
- APIs protegidas devuelven 401 sin sesión.
- Ocho rutas sensibles, incluidos `.env`, `.git`, seeds y código fuente, no se exponen.
- TRACE devuelve 405.
- Una solicitud cross-site normal devuelve 403.
- Login inválido devuelve un error genérico y no crea cookie.
- La cookie autenticada incluye `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` y `Max-Age`.
- Una cookie alterada devuelve 401.
- WebSocket autenticado abre y entrega el evento `ready` por `wss://`.
- No se concede CORS a un origen extranjero.

Controles fallidos:

1. `CFT-004`: la CSP pública contiene `unsafe-inline`, `unsafe-eval`, `ws:` y `wss:`.
2. `CFT-005`: `http://.../login` devuelve 200 en vez de redirigir a HTTPS.
3. `CFT-008`: `/_nuxt/@vite/client` responde 200 con el runtime de Vite.
4. `CFT-011`: un Origin extranjero acompañado de `X-Forwarded-Host` falsificado fue
   aceptado con estado 200 cuando faltaba `Sec-Fetch-Site`.
5. `CFT-018`: una copia de la cookie seguía autenticando con estado 200 después de logout.

## Interpretación

- `CFT-011` confirma el hallazgo SEC-011 detrás del túnel real.
- `CFT-004` y `CFT-008` confirman SEC-014: se publicó el servidor de desarrollo.
- `CFT-018` vuelve a confirmar SEC-003.
- `CFT-005` se registra como SEC-024.
- La puntuación permanece en 62/100 porque SEC-011 y SEC-014 ya tenían deducciones en
  la categoría web; no se aplica una penalización duplicada por la misma causa raíz.

Resultado íntegro y redactado:
`security-audit/test-results/cloudflare-tunnel-security-test.json`.
