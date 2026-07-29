# Inventario de endpoints

Generado: 2026-07-29T08:22:16.360Z

Total: 122 superficies HTTP/WebSocket.

| Metodo | Ruta | Autenticacion | Autorizacion | Entrada | Controles | Nota |
|---|---|---|---|---|---|---|
| POST | `/api/auth/login` | not declared in route | public | body | public, route-rate-limit, role-aware, normalized-errors |  |
| POST | `/api/auth/logout` | not declared in route | public | none | public, global-rate-limit |  |
| GET | `/api/auth/me` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, role-aware, normalized-errors |  |
| POST | `/api/auth/register` | not declared in route | public | body | public, route-rate-limit, role-aware, normalized-errors |  |
| DELETE | `/api/bovinos/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope |  |
| GET | `/api/bovinos/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| PUT | `/api/bovinos/:id` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/bovinos/:id/ownership-history` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/bovinos` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/bovinos` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| PUT | `/api/breeds/:id` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, role-aware, normalized-errors |  |
| GET | `/api/breeds` | required | route/service user scoping detected | query | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/breeds` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/community/conversations/:id/messages` | required | route/service user scoping detected | query, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/community/conversations/:id/messages` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/community/conversations/:id/read` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/community/conversations/:id/stream` | required | route/service user scoping detected | query, path | session, global-rate-limit, ownership-or-user-scope, sse |  |
| GET | `/api/community/conversations` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/community/conversations` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/community/friends` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/community/friends/requests/:id/accept` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/community/friends/requests/:id/reject` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/community/friends/requests` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/community/friends/requests` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/community/messages` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/community/stream` | required | route/service user scoping detected | query | session, global-rate-limit, ownership-or-user-scope, sse |  |
| GET | `/api/conversations/:id/messages` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/conversations/by-user/:id` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/conversations/by-user/test` | not declared in route | public | none | public, global-rate-limit | Unauthenticated diagnostic route returning {ok:true}. |
| POST | `/api/conversations/create` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/dashboard` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| DELETE | `/api/duenos/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/duenos/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| PUT | `/api/duenos/:id` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/duenos` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/duenos` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| DELETE | `/api/enfermedades/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| PUT | `/api/enfermedades/:id` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/enfermedades` | required | route/service user scoping detected | query | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/enfermedades` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| DELETE | `/api/historial-propiedad/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| PUT | `/api/historial-propiedad/:id` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/historial-propiedad` | required | route/service user scoping detected | query | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/historial-propiedad` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/ia/buscar` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/ia/chat` | required | route/service user scoping detected | body | session, route-rate-limit, ownership-or-user-scope, prompt-guardrail |  |
| POST | `/api/ia/evaluate` | required | route/service user scoping detected | body | session, route-rate-limit, ownership-or-user-scope, prompt-guardrail |  |
| POST | `/api/ia/function-calling` | required | route/service user scoping detected | body | session, route-rate-limit, ownership-or-user-scope, prompt-guardrail |  |
| POST | `/api/ia/router` | required | route/service user scoping detected | body | session, route-rate-limit, ownership-or-user-scope, prompt-guardrail, sse |  |
| POST | `/api/ia/venta` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| DELETE | `/api/memories/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| PUT | `/api/memories/:id` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/memories/create` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope |  |
| GET | `/api/memories` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/memories/retrieve` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/memories/search` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/notifications/:id/read` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/notifications` | required | route/service user scoping detected | query | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/notifications/read-all` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/notifications/stream` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, sse |  |
| GET | `/api/observabilidad/activity` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/observabilidad` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, role-aware, normalized-errors |  |
| DELETE | `/api/pesos/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| PUT | `/api/pesos/:id` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/pesos` | required | route/service user scoping detected | query | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/pesos` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| DELETE | `/api/ranchos/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/ranchos/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| PUT | `/api/ranchos/:id` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/ranchos` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/ranchos` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/reindexar` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/test` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope |  |
| POST | `/api/transferencias` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/transfers/:id/accept` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/transfers/:id/cancel` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/transfers/:id/reject` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/transfers` | required | route/service user scoping detected | query | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/transfers` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/users/search` | required | route/service user scoping detected | query | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| DELETE | `/api/vacunas-aplicadas/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| PUT | `/api/vacunas-aplicadas/:id` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/vacunas-aplicadas` | required | route/service user scoping detected | query | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/vacunas-aplicadas` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| DELETE | `/api/vacunas/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/vacunas/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| PUT | `/api/vacunas/:id` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/vacunas` | required | route/service user scoping detected | none | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/vacunas` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| DELETE | `/api/ventas/:id` | required | route/service user scoping detected | path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| PUT | `/api/ventas/:id` | required | route/service user scoping detected | body, path | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| GET | `/api/ventas` | required | route/service user scoping detected | query | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| POST | `/api/ventas` | required | route/service user scoping detected | body | session, global-rate-limit, ownership-or-user-scope, normalized-errors |  |
| ANY | `/api/ia/tools/actualizarBovino` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/actualizarEnfermedad` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/aplicarVacuna` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/crearBovino` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/crearDueno` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/crearRancho` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/crearVacuna` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/eliminarBovino` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/eliminarDueno` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/eliminarEnfermedad` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/eliminarRancho` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/eliminarVacuna` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/eliminarVacunaAplicada` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/findBovino` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/getEdad` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/getEnfermedades` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/getEstado` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/getHistorial` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/getPeso` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/getResumen` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/getVacunas` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/getVenta` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/platformTools` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/quitarPropiedad` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/registrarEnfermedad` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/registrarPeso` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/registrarVenta` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| ANY | `/api/ia/tools/transferirPropiedad` | no event handler declared in source module | named tool function expects a userId argument; no HTTP boundary is defined | none | named-export-only, runtime-behavior-tested-separately | Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api. |
| WS | `/_ws/community` | required during WebSocket upgrade | conversation membership checked for subscribe/send/read | websocket-event | encrypted-session-token, participant-check, message-deduplication | No event-level request-size or rate-limit control detected. |

## Modulos internos

Los siguientes archivos fueron pensados como modulos importados. El manifiesto Nitro de produccion los registra tambien como rutas sin metodo, por lo que ya estan incluidos en el conteo:

- `server/api/ia/tools/actualizarBovino.ts`
- `server/api/ia/tools/actualizarEnfermedad.ts`
- `server/api/ia/tools/aplicarVacuna.ts`
- `server/api/ia/tools/crearBovino.ts`
- `server/api/ia/tools/crearDueno.ts`
- `server/api/ia/tools/crearRancho.ts`
- `server/api/ia/tools/crearVacuna.ts`
- `server/api/ia/tools/eliminarBovino.ts`
- `server/api/ia/tools/eliminarDueno.ts`
- `server/api/ia/tools/eliminarEnfermedad.ts`
- `server/api/ia/tools/eliminarRancho.ts`
- `server/api/ia/tools/eliminarVacuna.ts`
- `server/api/ia/tools/eliminarVacunaAplicada.ts`
- `server/api/ia/tools/findBovino.ts`
- `server/api/ia/tools/getEdad.ts`
- `server/api/ia/tools/getEnfermedades.ts`
- `server/api/ia/tools/getEstado.ts`
- `server/api/ia/tools/getHistorial.ts`
- `server/api/ia/tools/getPeso.ts`
- `server/api/ia/tools/getResumen.ts`
- `server/api/ia/tools/getVacunas.ts`
- `server/api/ia/tools/getVenta.ts`
- `server/api/ia/tools/platformTools.ts`
- `server/api/ia/tools/quitarPropiedad.ts`
- `server/api/ia/tools/registrarEnfermedad.ts`
- `server/api/ia/tools/registrarPeso.ts`
- `server/api/ia/tools/registrarVenta.ts`
- `server/api/ia/tools/transferirPropiedad.ts`
