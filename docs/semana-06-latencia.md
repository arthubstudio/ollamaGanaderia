# Semana 06 - Registro de latencia

## Objetivo

Comparar la experiencia de respuesta de Ganaderia_AI en entorno local y mediante exposicion publica por tunel.

No inventar datos. Completar esta tabla durante la prueba real.

## Entorno local

URL:

```text
http://localhost:3000
```

Pregunta de prueba:

```text
¿Qué puedes hacer?
```

| Prueba | Hora | TTFT observado | Latencia total | Resultado | Notas |
| --- | --- | --- | --- | --- | --- |
| Local 1 | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Local 2 | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Local 3 | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

## Entorno publico

URL publica:

```text
PENDIENTE
```

Proveedor:

```text
PENDIENTE: Cloudflare Tunnel o Ngrok.
```

Pregunta de prueba:

```text
¿Qué puedes hacer?
```

| Prueba | Hora | TTFT observado | Latencia total | Resultado | Notas |
| --- | --- | --- | --- | --- | --- |
| Publico 1 | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Publico 2 | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Publico 3 | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

## Donde consultar metricas internas

En la aplicacion:

```text
/observabilidad
```

En base de datos:

```sql
SELECT
  id,
  session_id,
  ttft_ms,
  total_latency_ms,
  tokens_per_second,
  was_blocked,
  timestamp
FROM ai_logs
ORDER BY id DESC
LIMIT 10;
```

## Observaciones

```text
PENDIENTE: describir diferencias entre local y publico.
```

## Conclusiones

```text
PENDIENTE: agregar reflexion tecnica despues de medir.
```
