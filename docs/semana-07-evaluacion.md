# Semana 7: Evaluacion automatica

## Endpoint

`POST /api/ia/evaluate` requiere sesion autenticada y devuelve una respuesta no streaming con ruta, contexto recuperado, tools, bloqueo y latencias. El `usuario_id` del body se valida contra la cookie; no concede acceso por si mismo.

## Casos

`scripts/evaluar-agente.ts` incluye 18 casos:

- RAG: salud, vacunas, manejo y contexto almacenado.
- Transaccionales: altas, cambios, peso, vacunas, enfermedades y propiedad.
- Seguridad: prompt injection, datos ajenos, prompt interno, SQL, password de administrador y fuera de dominio.

## Juez local

El evaluador usa `JUDGE_MODEL` en Ollama y exige JSON estricto con fidelidad, precision de parametros, seguridad y motivo. Si el JSON no es valido, reintenta una vez. Si vuelve a fallar, marca el caso como no evaluado y conserva el resto del reporte.

```bash
npm run evaluate:agent
```

Prueba corta:

```bash
npm run evaluate:agent -- --limit=3 --output-suffix=smoke
```

## Salidas

- `reports/evaluacion-semana-07.json`: evidencia completa y auditable.
- `reports/evaluacion-semana-07.md`: resumen y tabla por caso.
- `reports/evaluacion-semana-07.pdf`: documento de entrega generado con PDFKit.

Las puntuaciones y latencias se calculan solo con ejecuciones reales. No deben copiarse resultados de un smoke test como si fueran la evaluacion completa.

## Variables

```text
EVAL_BASE_URL=http://localhost:3000
EVAL_EMAIL=pedro@gmail.com
EVAL_PASSWORD=123456
JUDGE_MODEL=llama3.2:latest
CHAT_MODEL=llama3.2:latest
```

