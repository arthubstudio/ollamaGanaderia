# Semana 7: RAG avanzado

## Pipeline

```text
Pregunta
-> embedding local con nomic-embed-text
-> Top-10 por similitud coseno
-> Top-10 por PostgreSQL Full Text Search
-> Reciprocal Rank Fusion
-> Top-10 fusionado
-> reranker local
-> Top-3
-> llama3.2:latest
```

## Busqueda hibrida

La busqueda vectorial usa pgvector y el operador de distancia coseno. La busqueda textual usa `websearch_to_tsquery`, `to_tsvector` y `ts_rank_cd`. Ambas fuentes filtran los datos privados por `usuario_id`; los documentos ganaderos estaticos tienen `bovino_id IS NULL` y son globales.

Se consultan `semantic_contexts` y `memories`. Los resultados mantienen fuente, contenido, score vectorial, score textual y score fusionado.

## RRF

Para cada resultado se suma:

```text
1 / (60 + posicion)
```

Un documento presente en ambos rankings recibe contribucion de ambos y normalmente sube posiciones.

## Reranker

El servicio opcional vive en `services/reranker/`, expone `POST /rerank` y usa un `CrossEncoder` local. El modelo predeterminado es `BAAI/bge-reranker-v2-m3`.

```bash
docker compose --profile reranker up -d reranker
```

No se inicia en el Compose normal y no se descarga automaticamente durante `npm install`.

## Fallback

Si el servicio no responde antes del timeout, el pipeline conserva los tres primeros resultados por RRF. La respuesta no se bloquea y observabilidad registra `reranker_used = 0`, latencia y motivo del fallback.

## Indices

La migracion `003_semana_07_multiagente.sql` agrega indices GIN para Full Text Search e indices compuestos para usuario, nombre, bovino y fechas. El indice HNSW existente se conserva.

