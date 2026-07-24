# Ganaderia_AI

Sistema fullstack para gestion de ganado bovino con inteligencia artificial local.

Ganaderia_AI permite administrar bovinos, duenos, ranchos, pesos, vacunas, enfermedades, ventas e historial de propiedad. Tambien incluye un asistente conversacional con Ollama, pgvector, RAG, memorias y streaming SSE.

## Stack

Frontend:

- Nuxt 4
- Vue 3
- TailwindCSS
- Nuxt Icon

Backend:

- Nitro Server Routes
- PostgreSQL
- Drizzle ORM
- SQL directo con `postgres`

IA:

- Ollama
- `llama3.2:latest`
- `nomic-embed-text`
- pgvector
- Arquitectura multiagente
- Busqueda hibrida vectorial + Full Text Search + RRF
- Reranking local con fallback
- Function Calling
- Streaming SSE

Infraestructura y pruebas:

- Docker Compose
- PostgreSQL + pgvector
- Ollama
- Playwright E2E

## Requisitos

- Node.js 20+
- npm
- Docker
- Docker Compose
- Git

## Instalacion

```bash
npm install
```

## Levantar servicios

```bash
docker compose up -d
```

El `docker-compose.yml` levanta:

- `ganaderia_db`: PostgreSQL con pgvector en `localhost:5433`.
- `ollamaganaderia`: Ollama en `localhost:11435`.

Los datos persisten en los volumenes:

- `postgres_data`
- `ollama_data`
- `reranker_cache` cuando se activa el perfil opcional del reranker

En una base nueva, Docker ejecuta `database/seeds.sql` como script de inicializacion. Si el volumen ya existe, ejecuta el seed manualmente:

```bash
npm run db:seed
```

## Descargar modelos de Ollama

```bash
docker exec -it ollamaganaderia ollama pull llama3.2:latest
docker exec -it ollamaganaderia ollama pull nomic-embed-text
```

## Migraciones aditivas

En una base existente, aplica las migraciones en orden. Todas son aditivas y usan validaciones idempotentes:

```bash
npm run db:migrate:week7
npm run db:migrate:platform
npm run db:migrate:improvements
npm run db:migrate:websocket
```

En una base nueva, Docker Compose ejecuta `database/seeds.sql` y despues las migraciones montadas como scripts de inicializacion. En un volumen existente se deben ejecutar los comandos anteriores manualmente.

## Reranker local

El flujo normal funciona aunque el reranker no este activo: usa los tres mejores resultados de RRF como fallback.

Para iniciar el reranker local opcional:

```bash
docker compose --profile reranker up -d reranker
```

El primer arranque descarga `BAAI/bge-reranker-v2-m3` dentro de `reranker_cache`; es un modelo pesado y no se inicia ni descarga con `docker compose up -d`. Para hardware limitado se puede definir otro `RERANKER_MODEL` local compatible con `sentence-transformers`.

## Ejecutar la aplicacion

```bash
npm run dev
```

Abrir:

```text
http://localhost:3000
```

Usuario demo:

```text
Email: pedro@gmail.com
Password: 123456
```

## Pruebas E2E

Ejecutar todas las pruebas:

```bash
npm run test:e2e
```

Ejecutar solo la prueba de IA:

```bash
npm run test:e2e:ia
```

Ejecutar las pruebas multiagente:

```bash
npm run test:e2e:multi-agent
```

Ejecutar las pruebas de vacunacion, venta, relaciones, contexto y loading:

```bash
npm run test:e2e:improvements
```

Ver reporte de Playwright:

```bash
npx playwright show-report
```

## Exposicion publica

Con Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```
```bash
SELECT COUNT(*) FROM bovinos;
```
Con Ngrok:

```bash
ngrok http 3000
```

## Comandos utiles

Sembrar un lote ficticio e idempotente de 10,000 registros:

```bash
npm run seed:stress -- --count=10000 --batch=semana07-10k
```

Sembrar 50,000 registros:

```bash
npm run seed:stress -- --count=50000 --batch=semana07-50k
```

Por defecto los contextos de estres no generan embeddings uno por uno. Para generar un subconjunto real de 100 embeddings:

```bash
npm run seed:stress -- --count=10000 --batch=semana07-emb --real-embeddings=100
```

Ejecutar la evaluacion completa con Ollama como juez local:

```bash
npm run evaluate:agent
```

Los resultados reales se escriben en:

```text
reports/evaluacion-semana-07.json
reports/evaluacion-semana-07.md
reports/evaluacion-semana-07.pdf
```

Prueba corta de tres casos, sin reemplazar el reporte final:

```bash
npm run evaluate:agent -- --limit=3 --output-suffix=smoke
```

Ver contenedores:

```bash
docker compose ps
```

Ver logs:

```bash
docker compose logs -f
```

Entrar a PostgreSQL:

```bash
docker exec -it ganaderia_db psql -U ganaderia -d ganaderia_ai
```

Detener servicios:

```bash
docker compose down
```

## Consultas utiles

```sql
\dt
SELECT * FROM bovinos;
SELECT * FROM duenos;
SELECT * FROM ranchos;
SELECT * FROM vacunas;
SELECT * FROM pesos;
SELECT * FROM enfermedades;
```

## Flujo Semana 7

```text
Usuario -> Router determinista -> Agente transaccional -> Tools -> PostgreSQL
Usuario -> Router determinista -> Agente RAG -> Hybrid Search -> Reranker -> Ollama
```

- `/api/ia/router` conserva el streaming SSE usado por el chat.
- `/api/ia/evaluate` ofrece una respuesta no streaming para pruebas y evaluacion.
- El agente transaccional reutiliza las tools existentes y la confirmacion previa a escrituras.
- El agente RAG no ejecuta escrituras y usa Top-10, RRF, reranker local y Top-3 final.
- `/observabilidad` muestra agente, intencion, confianza, tools y metricas del RAG.

## Comandos principales

```bash
npm install
docker compose up -d
npm run db:seed
npm run dev
npm run seed:stress -- --count=10000 --batch=semana07-10k
npm run seed:stress -- --count=50000 --batch=semana07-50k
npm run evaluate:agent
npm run test:e2e
```

## Notas para Semana 6

- El flujo principal local es `npm install`, `docker compose up -d`, `npm run db:seed`, `npm run dev`.
- Para probar IA, Ollama debe tener descargados `llama3.2:latest` y `nomic-embed-text`.
- La prueba `e2e/ia.spec.ts` valida login, entrada al asistente y respuesta a `¿Qué puedes hacer?`.
- La exposicion publica puede hacerse con Cloudflare Tunnel o Ngrok apuntando a `http://localhost:3000`.

## Riesgos conocidos

- La autenticacion usa cookie HttpOnly firmada; los usuarios demo legacy actualizan su hash al iniciar sesion.
- Hay credenciales locales hardcodeadas.
- Algunos endpoints usan Drizzle y otros SQL directo.
- `database/schema.sql`, `database/seeds.sql` y `drizzle/schema.ts` no estan completamente sincronizados.
- Hay textos heredados con el nombre anterior `vacas`.
- Hay problemas de encoding visibles en algunas vistas.
- El reranker BGE requiere RAM, almacenamiento y una descarga inicial considerable.
- El estado conversacional pendiente vive en memoria y no se comparte entre multiples instancias.
- Las metricas de Semana 7 solo deben citarse despues de ejecutar el seeder y el evaluador en el equipo de entrega.

## Plataforma de transferencias y comunidad

La migracion aditiva de esta fase se aplica en bases existentes con:

```bash
npm run db:migrate:platform
npm run db:migrate:improvements
npm run db:migrate:websocket
```

En bases nuevas, Docker Compose monta las migraciones `004`, `005` y `006` despues de `database/seeds.sql` y las ejecuta automaticamente. No elimina tablas ni registros.

Funcionalidades disponibles:

- `/transferencias`: solicitudes entre cuentas, bandejas enviadas/recibidas, aceptar, rechazar y cancelar.
- `/notificaciones`: actividad inmediata mediante SSE y estado leido.
- `/razas`: catalogo global, busqueda, filtros, alta, edicion y activacion.
- `/amigos`: busqueda de usuarios y solicitudes de contacto.
- `/mensajes`: chat privado entre contactos mediante WebSocket autenticado, reconexion y recuperacion por cursor.
- `/bovinos/:id/historial`: bitacora permanente de transferencias del bovino.
- `/observabilidad`: logs IA y auditoria operativa.

La aceptacion de una transferencia se ejecuta dentro de una transaccion con bloqueo de filas. Cambia `bovinos.usuario_id`, actualiza el rancho activo y las relaciones de propietarios, y mantiene pesos, enfermedades, historial, contextos y cualquier relacion ligada por `bovino_id`. Las vacunas aplicadas se enlazan al catalogo equivalente del receptor y las memorias que tengan `bovino_id` cambian de cuenta.

Si el arete ya existe en la cuenta receptora, se genera el siguiente arete atomico de esa cuenta y ambos valores quedan registrados en el historial de transferencia.

### Pruebas de plataforma

```bash
npm run test
npm run test:e2e:improvements
npm run test:e2e:platform -- --project=chromium
npm run test:e2e:chat
npm run build
```

La prueba E2E crea dos cuentas unicas, registra raza, bovino y peso, transfiere el bovino, comprueba aislamiento de permisos, crea una amistad, envia un mensaje, revisa notificaciones, consulta el catalogo mediante IA y abre las paginas nuevas.

`npm run test:e2e:chat` abre dos sesiones autenticadas y comprueba recepcion sin recarga, contador no leido, estados entregado/leido, deduplicacion por `client_message_id` y recuperacion despues de desconectar la red.

Documentacion detallada:

```text
docs/plataforma-transferencias-comunidad.md
```

## Reglas actuales de vacunacion y venta

- La misma vacuna no puede repetirse para el mismo bovino antes de seis meses calendario.
- Cada aplicacion conserva `fecha_aplicacion`, `proxima_fecha_permitida` y `aplicada_por_usuario_id`.
- El historial de aplicaciones no se sobrescribe y la UI y la IA usan el mismo servicio transaccional.
- Un bovino esta listo para venta con un ultimo peso de al menos `380 kg` y estas vacunas: Brucelosis, Rabia Paralitica Bovina y Carbon Sintomatico (Pierna Negra) y Edema Maligno.
- Ranchos y bovinos admiten varios duenos mediante `rancho_duenos` y `bovino_duenos`; cada bovino conserva un solo `rancho_id` activo.
