# Semana 06 - Exposicion publica con tunel

## Objetivo

Exponer temporalmente la aplicacion Ganaderia_AI desde el entorno local hacia internet para validar conectividad externa durante la entrega de Semana 6.

## Requisitos previos

- Aplicacion corriendo en `http://localhost:3000`.
- Docker Compose activo.
- Base de datos inicializada.
- Modelos de Ollama descargados.

## Preparacion local

```bash
npm install
docker compose up -d
npm run db:seed
docker exec -it ollamaganaderia ollama pull llama3.2:latest
docker exec -it ollamaganaderia ollama pull nomic-embed-text
npm run dev
```

Verificar en navegador:

```text
http://localhost:3000
```

## Opcion A: Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3000
```

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

```bash
ngrok http 3000
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
2. Iniciar sesion con `pedro@gmail.com` / `123456`.
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
