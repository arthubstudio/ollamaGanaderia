# Observacion de trafico saliente

La auditoria autorizo exclusivamente `registry.npmjs.org` mediante dos comandos:

- `npm audit --json`
- `npm audit --omit=dev --json`

No se consultaron endpoints de produccion, tuneles, Ollama remoto ni servicios de IA.

Al solicitar la pagina SSR del build local, el log de `@nuxt/icon` indico que el
servidor intentaba obtener varios iconos desde Iconify API. El servidor se detuvo
en cuanto se observo el mensaje. No se concedio permiso para continuar y no se
comprobo conectividad al dominio, por lo que el estado exacto es "intento observado;
finalizacion no confirmada".

Recomendacion para la siguiente fase: empaquetar de forma local todos los iconos
usados y agregar una prueba de egress-deny para el build de produccion.
