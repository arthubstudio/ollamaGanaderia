# Evidencia de herramientas y pruebas

## Resultados

| Verificacion | Resultado |
|---|---:|
| Pruebas unitarias del repositorio | 59/59 PASS |
| Pruebas dinamicas HTTP/API/DB | 43 PASS, 17 FAIL de control, 0 errores |
| Pruebas WebSocket locales | 7/7 PASS |
| TypeScript de scripts | PASS |
| Build Nuxt de produccion | PASS |
| Docker Compose del proyecto | valido |
| Docker Compose de auditoria | valido |
| Inventario Nitro | 122 superficies |
| `npm audit` completo | 9 vulnerabilidades |
| `npm audit --omit=dev` | 6 vulnerabilidades |

Los `FAIL` dinamicos significan que el runner funciono y demostro que el control
esperado no existe; no son errores de ejecucion del runner.

## Dependencias

- Auditoria completa: 1 critica, 4 altas y 4 moderadas.
- Arbol de produccion: 1 critica, 4 altas y 1 baja.
- Todos los paquetes reportados, salvo `drizzle-kit`, son transitivos.
- La mayoria de rutas detectadas pertenecen a build, empaquetado o servidor de
  desarrollo; no se demostro explotabilidad desde un endpoint productivo.
- `npm ls --all` detecto una resolucion de esbuild marcada como invalida para una
  dependencia Vite, aunque el build finalizo correctamente.

## Docker

- PostgreSQL, Ollama y reranker se publican solo en loopback.
- Existen healthchecks y volumenes persistentes.
- Ollama usa una etiqueta flotante `latest`.
- El reranker no fija hashes de paquetes y su Dockerfile no declara usuario no-root.
- No se inicio el perfil del reranker ni se descargaron modelos.
