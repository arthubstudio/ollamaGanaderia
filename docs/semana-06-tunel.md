# Semana 06 - Exposicion publica con tunel

## Objetivo

Exponer temporalmente la aplicacion Ganaderia_AI desde el entorno local hacia internet para validar conectividad externa durante la entrega de Semana 6.

## Requisitos previos

- Aplicacion validada localmente en `http://localhost:3000`.
- Docker Compose activo.
- Base de datos inicializada.
- Modelos de Ollama descargados.
- Rol runtime y secreto configurados con `npm run db:runtime:configure`.

## Preparacion local

```bash
npm install
docker compose up -d
npm run db:seed
npm run db:runtime:configure
npm run db:runtime:verify
docker exec -it ollamaganaderia ollama pull llama3.2:latest
docker exec -it ollamaganaderia ollama pull nomic-embed-text
npm run dev
```

Verificar en navegador:

```text
http://localhost:3000
```

## Opcion A: Cloudflare Tunnel

No uses `npm run dev` detras de Cloudflare o Ngrok. Para un Quick Tunnel ejecuta:

```bash
npm run tunnel:quick
```

Este comando compila Nitro, crea el tunel hacia `127.0.0.1:3001`, detecta la URL
temporal e inyecta el origen y hostname exactos solo en el proceso publicado.
Cada nueva URL se configura automaticamente y `.env` no se modifica.

Para un hostname estable o un flujo manual, configura primero la URL exacta en
`.env`, sin comodines:

```env
NUXT_PUBLIC_APP_ORIGIN=https://HOST-EXACTO.trycloudflare.com
NUXT_ALLOWED_HOSTS=HOST-EXACTO.trycloudflare.com
NUXT_TRUST_PROXY=loopback
```

Luego compila e inicia el servidor Nitro de produccion y apunta el tunel a 3001:

```bash
npm run tunnel:serve
cloudflared tunnel --url http://localhost:3001
```

El servidor Vite acepta unicamente loopback. El flujo publico usa Nitro en
`127.0.0.1:3001`, valida el host exacto y exige una URL publica HTTPS. No uses
`cloudflared tunnel --url http://localhost:3000`, `allowedHosts: true` ni el
comodin `.trycloudflare.com`.

URL generada:

```text
PENDIENTE: pegar aqui la URL publica de Cloudflare.
```

Hora de inicio:

```text
PENDIENTE
```

Hora de cierre:

```text
PENDIENTE
```

Resultado:

```text
PENDIENTE: indicar si cargo login, dashboard e IA.
```

## Opcion B: Ngrok

Aplica el mismo orden: inicia Ngrok para conocer la URL, configura
`NUXT_PUBLIC_APP_ORIGIN` y `NUXT_ALLOWED_HOSTS` con el hostname exacto, y despues
ejecuta `npm run tunnel:serve` en otra terminal.

```bash
ngrok http 3001
```

URL generada:

```text
PENDIENTE: pegar aqui la URL publica de Ngrok.
```

Hora de inicio:

```text
PENDIENTE
```

Hora de cierre:

```text
PENDIENTE
```

Resultado:

```text
PENDIENTE: indicar si cargo login, dashboard e IA.
```

## Pruebas manuales sugeridas

1. Abrir URL publica.
2. Iniciar sesion con una cuenta propia registrada para la prueba.
3. Entrar a `/ia`.
4. Preguntar: `¿Qué puedes hacer?`.
5. Confirmar que la respuesta aparece por streaming.
6. Tomar capturas para el PDF.

## Evidencias pendientes

- Captura del comando del tunel activo.
- Captura de la URL publica abierta en navegador.
- Captura del login.
- Captura del asistente IA respondiendo.
- Registro de hora de inicio y fin.
