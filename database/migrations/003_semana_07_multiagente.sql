BEGIN;

ALTER TABLE ai_logs ADD COLUMN IF NOT EXISTS selected_agent VARCHAR(32);
ALTER TABLE ai_logs ADD COLUMN IF NOT EXISTS intent VARCHAR(100);
ALTER TABLE ai_logs ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,4);
ALTER TABLE ai_logs ADD COLUMN IF NOT EXISTS route_reason TEXT;
ALTER TABLE ai_logs ADD COLUMN IF NOT EXISTS context_sources TEXT;
ALTER TABLE ai_logs ADD COLUMN IF NOT EXISTS retrieved_count INTEGER DEFAULT 0;
ALTER TABLE ai_logs ADD COLUMN IF NOT EXISTS reranked_count INTEGER DEFAULT 0;
ALTER TABLE ai_logs ADD COLUMN IF NOT EXISTS reranker_used INTEGER DEFAULT 0;
ALTER TABLE ai_logs ADD COLUMN IF NOT EXISTS retrieval_latency_ms INTEGER DEFAULT 0;
ALTER TABLE ai_logs ADD COLUMN IF NOT EXISTS rerank_latency_ms INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS semantic_contexts_fts_idx
ON semantic_contexts
USING GIN (to_tsvector('simple', COALESCE(contenido, '')));

CREATE INDEX IF NOT EXISTS memories_fts_idx
ON memories
USING GIN (to_tsvector('simple', COALESCE(contenido, '')));

CREATE INDEX IF NOT EXISTS bovinos_usuario_nombre_idx
ON bovinos (usuario_id, LOWER(nombre));

CREATE INDEX IF NOT EXISTS pesos_bovino_fecha_idx
ON pesos (bovino_id, fecha DESC);

CREATE INDEX IF NOT EXISTS enfermedades_bovino_fecha_idx
ON enfermedades (bovino_id, fecha DESC);

CREATE INDEX IF NOT EXISTS vacuna_aplicada_bovino_fecha_idx
ON vacuna_aplicada (bovino_id, fecha_aplicacion DESC);

CREATE INDEX IF NOT EXISTS historial_propiedad_bovino_fecha_idx
ON historial_propiedad (bovino_id, fecha_inicio DESC);

CREATE TABLE IF NOT EXISTS stress_seed_batches (
    batch_key VARCHAR(80) PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    requested_count INTEGER NOT NULL,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

COMMIT;

