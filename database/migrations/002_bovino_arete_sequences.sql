BEGIN;

CREATE TABLE IF NOT EXISTS bovino_arete_sequences (
  usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  last_value INTEGER NOT NULL CHECK (last_value >= 0),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE bovinos DROP CONSTRAINT IF EXISTS bovinos_numero_arete_key;

CREATE UNIQUE INDEX IF NOT EXISTS bovinos_usuario_arete_uq
ON bovinos (usuario_id, UPPER(numero_arete));

INSERT INTO bovino_arete_sequences (usuario_id, last_value)
SELECT usuario_id, MAX((substring(numero_arete FROM '^MX-([0-9]{4})$'))::INTEGER)
FROM bovinos
WHERE usuario_id IS NOT NULL AND numero_arete ~ '^MX-[0-9]{4}$'
GROUP BY usuario_id
ON CONFLICT (usuario_id)
DO UPDATE SET
  last_value = GREATEST(bovino_arete_sequences.last_value, EXCLUDED.last_value),
  updated_at = NOW();

COMMIT;
