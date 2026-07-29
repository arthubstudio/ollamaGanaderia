# Evidencia HTTP del build de produccion

Build comprobado en `127.0.0.1:3202` y detenido al terminar.

## Controles aprobados

- `npm run build`: exitoso.
- CSP de produccion sin `unsafe-inline` ni `unsafe-eval`; hashes para scripts/estilos.
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- COOP y CORP en `same-origin`.
- Referrer Policy y Permissions Policy presentes.
- No se generaron archivos `.map` bajo `.output/public`.
- Los errores internos se devolvieron con mensaje JSON generico.

La ausencia de HSTS sobre HTTP loopback no se considero hallazgo: la cabecera solo
debe verificarse en una solicitud HTTPS real, la cual estuvo fuera del alcance.

## Observaciones

- `GET /api/conversations/by-user/test` respondio 200 y `{ok:true}` sin sesion.
- `GET /api/ia/tools/crearVacuna` respondio 500 sin sesion. No ejecuto la tool ni
  revelo un stack, pero confirma que Nitro registro el modulo interno como ruta.
- `Server-Timing` enumero nombres de chunks y rutas cargadas.
- La pagina SSR registro un intento de resolucion contra Iconify API; se detuvo el proceso.
