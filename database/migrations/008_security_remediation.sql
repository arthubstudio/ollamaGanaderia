BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE usuarios ALTER COLUMN rol SET DEFAULT 'usuario';

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS directory_key UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_directory_key_uq
ON usuarios (directory_key);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id_hash CHAR(64) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent_hash CHAR(64)
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_active_idx
ON auth_sessions (user_id, expires_at)
WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx
ON auth_sessions (expires_at);

ALTER TABLE semantic_contexts
  ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS source VARCHAR(80) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS trusted BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semantic_contexts_scope_check'
  ) THEN
    ALTER TABLE semantic_contexts
      ADD CONSTRAINT semantic_contexts_scope_check
      CHECK (scope IN ('private', 'public')) NOT VALID;
  END IF;
END $$;

UPDATE semantic_contexts sc
SET owner_user_id = b.usuario_id,
    scope = 'private',
    source = CASE WHEN sc.source = 'unknown' THEN 'bovino' ELSE sc.source END,
    trusted = TRUE
FROM bovinos b
WHERE sc.bovino_id = b.id;

UPDATE semantic_contexts
SET scope = 'public',
    source = 'seed_knowledge',
    trusted = TRUE,
    owner_user_id = NULL
WHERE bovino_id IS NULL
  AND contenido IN (
    'La prevencion sanitaria bovina combina vacunacion, observacion diaria, bioseguridad, agua limpia y seguimiento veterinario.',
    'La brucelosis bovina es una enfermedad infecciosa. Su prevencion y vacunacion deben seguir la normativa local y la indicacion veterinaria.',
    'Las vacunas clostridiales ayudan a prevenir enfermedades causadas por bacterias del genero Clostridium y requieren un esquema definido por un veterinario.',
    'El complejo respiratorio bovino se reduce con vacunacion, ventilacion adecuada, menor estres de transporte y aislamiento temprano de animales con sintomas.',
    'El manejo de peso debe usar mediciones fechadas y consistentes; una sola estimacion visual no sustituye un registro real.',
    'Ante fiebre, perdida de apetito, tos persistente o dificultad respiratoria, se debe aislar al bovino y solicitar valoracion veterinaria.'
  );

CREATE INDEX IF NOT EXISTS semantic_contexts_scope_owner_idx
ON semantic_contexts (scope, trusted, owner_user_id);

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS transferable BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE ai_logs
  ADD COLUMN IF NOT EXISTS prompt_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS response_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS prompt_length INTEGER,
  ADD COLUMN IF NOT EXISTS response_length INTEGER,
  ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ;

UPDATE ai_logs
SET prompt_hash = CASE
      WHEN user_prompt IS NULL THEN prompt_hash
      ELSE encode(digest(user_prompt, 'sha256'), 'hex')
    END,
    response_hash = CASE
      WHEN system_response IS NULL THEN response_hash
      ELSE encode(digest(system_response, 'sha256'), 'hex')
    END,
    prompt_length = COALESCE(prompt_length, char_length(user_prompt)),
    response_length = COALESCE(response_length, char_length(system_response)),
    retention_until = COALESCE(retention_until, timestamp + INTERVAL '30 days'),
    user_prompt = NULL,
    system_response = NULL,
    tools_executed = NULL
WHERE user_prompt IS NOT NULL
   OR system_response IS NOT NULL
   OR tools_executed IS NOT NULL
   OR retention_until IS NULL;

CREATE INDEX IF NOT EXISTS ai_logs_retention_idx
ON ai_logs (retention_until);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pesos_peso_domain_check'
  ) THEN
    ALTER TABLE pesos
      ADD CONSTRAINT pesos_peso_domain_check
      CHECK (peso > 0 AND peso <= 2500) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memories_content_length_check'
  ) THEN
    ALTER TABLE memories
      ADD CONSTRAINT memories_content_length_check
      CHECK (char_length(contenido) <= 5000) NOT VALID;
  END IF;
END $$;

COMMIT;
