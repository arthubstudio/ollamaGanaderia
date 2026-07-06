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
- RAG
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

En una base nueva, Docker ejecuta `database/seeds.sql` como script de inicializacion. Si el volumen ya existe, ejecuta el seed manualmente:

```bash
npm run db:seed
```

## Descargar modelos de Ollama

```bash
docker exec -it ollamaganaderia ollama pull llama3.2:latest
docker exec -it ollamaganaderia ollama pull nomic-embed-text
```

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

Ver reporte de Playwright:

```bash
npx playwright show-report
```

## Exposicion publica

Con Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Con Ngrok:

```bash
ngrok http 3000
```

## Comandos utiles

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

## Notas para Semana 6

- El flujo principal local es `npm install`, `docker compose up -d`, `npm run db:seed`, `npm run dev`.
- Para probar IA, Ollama debe tener descargados `llama3.2:latest` y `nomic-embed-text`.
- La prueba `e2e/ia.spec.ts` valida login, entrada al asistente y respuesta a `¿Qué puedes hacer?`.
- La exposicion publica puede hacerse con Cloudflare Tunnel o Ngrok apuntando a `http://localhost:3000`.

## Riesgos conocidos

- La autenticacion actual se basa en `localStorage`.
- Las contrasenas de demo estan en texto plano.
- Hay credenciales locales hardcodeadas.
- Algunos endpoints usan Drizzle y otros SQL directo.
- `database/schema.sql`, `database/seeds.sql` y `drizzle/schema.ts` no estan completamente sincronizados.
- Hay textos heredados con el nombre anterior `vacas`.
- Hay problemas de encoding visibles en algunas vistas.
