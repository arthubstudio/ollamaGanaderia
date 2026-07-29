# Alcance y seguridad de la auditoria

- Fecha: 2026-07-29.
- Aplicacion evaluada: Ganaderia AI en el workspace local.
- Aplicacion dinamica: `http://127.0.0.1:3201`.
- Build de produccion: `http://127.0.0.1:3202`, solo durante comprobaciones puntuales.
- Base de datos: `ganaderia_ai_security_test` en `127.0.0.1:55433`.
- Contenedor: `ganaderia_security_db`, proyecto Compose `ganaderia-security`.
- Identidades: nombres sinteticos y correos bajo `.example.test`.
- Credenciales: generadas aleatoriamente en memoria; no se guardaron en evidencias.
- Base de desarrollo existente: no consultada, truncada ni modificada.
- Produccion, tuneles y dominios publicos: no evaluados ni contactados.
- Red externa autorizada: solo `registry.npmjs.org` mediante `npm audit`.
- Pruebas destructivas, fuerza bruta y denegacion de servicio: omitidas.

Durante una comprobacion de la pagina del build, `@nuxt/icon` registro un intento de
resolver iconos desde la API de Iconify. El proceso se detuvo inmediatamente. No se
continuaron solicitudes a ese dominio y el log no permite confirmar si la conexion
se completo. Esta observacion se conserva como evidencia de egress de la propia
aplicacion, no como una solicitud deliberada del auditor.

No se modifico codigo productivo durante esta fase. Los unicos archivos creados o
editados por la auditoria estan bajo `security-audit/`.
