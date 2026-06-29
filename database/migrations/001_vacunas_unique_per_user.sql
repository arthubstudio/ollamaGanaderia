-- Permite que cada usuario tenga su propio catálogo de vacunas
-- (mismo nombre de vacuna en distintos usuarios).

ALTER TABLE vacunas DROP CONSTRAINT IF EXISTS vacunas_nombre_key;

CREATE UNIQUE INDEX IF NOT EXISTS vacunas_usuario_nombre_idx
ON vacunas (usuario_id, LOWER(nombre));
