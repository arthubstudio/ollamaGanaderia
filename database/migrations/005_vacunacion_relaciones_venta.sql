BEGIN;

-- Historial de vacunacion con intervalo semestral y usuario aplicador.
ALTER TABLE vacuna_aplicada
  ADD COLUMN IF NOT EXISTS proxima_fecha_permitida DATE,
  ADD COLUMN IF NOT EXISTS aplicada_por_usuario_id INTEGER;

UPDATE vacuna_aplicada
SET fecha_aplicacion = COALESCE(fecha_aplicacion, created_at::date, CURRENT_DATE)
WHERE fecha_aplicacion IS NULL;

UPDATE vacuna_aplicada va
SET aplicada_por_usuario_id = b.usuario_id
FROM bovinos b
WHERE b.id = va.bovino_id
  AND va.aplicada_por_usuario_id IS NULL;

UPDATE vacuna_aplicada
SET proxima_fecha_permitida = (fecha_aplicacion + INTERVAL '6 months')::date
WHERE proxima_fecha_permitida IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vacuna_aplicada_usuario_fk'
  ) THEN
    ALTER TABLE vacuna_aplicada
      ADD CONSTRAINT vacuna_aplicada_usuario_fk
      FOREIGN KEY (aplicada_por_usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE vacuna_aplicada
  ALTER COLUMN fecha_aplicacion SET NOT NULL,
  ALTER COLUMN proxima_fecha_permitida SET NOT NULL,
  ALTER COLUMN aplicada_por_usuario_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS vacuna_aplicada_intervalo_idx
  ON vacuna_aplicada (bovino_id, vacuna_id, fecha_aplicacion DESC);
CREATE INDEX IF NOT EXISTS vacuna_aplicada_usuario_idx
  ON vacuna_aplicada (aplicada_por_usuario_id, fecha_aplicacion DESC);

-- Rancho activo y creador del bovino; usuario_id sigue representando la cuenta propietaria.
ALTER TABLE bovinos
  ADD COLUMN IF NOT EXISTS rancho_id INTEGER,
  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bovinos_rancho_activo_fk'
  ) THEN
    ALTER TABLE bovinos
      ADD CONSTRAINT bovinos_rancho_activo_fk
      FOREIGN KEY (rancho_id) REFERENCES ranchos(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bovinos_created_by_usuario_fk'
  ) THEN
    ALTER TABLE bovinos
      ADD CONSTRAINT bovinos_created_by_usuario_fk
      FOREIGN KEY (created_by_user_id) REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE bovinos SET created_by_user_id = usuario_id
WHERE created_by_user_id IS NULL;

UPDATE bovinos b
SET rancho_id = (
  SELECT hp.rancho_id
  FROM historial_propiedad hp
  WHERE hp.bovino_id = b.id
    AND hp.fecha_fin IS NULL
    AND hp.rancho_id IS NOT NULL
  ORDER BY hp.fecha_inicio DESC NULLS LAST, hp.id DESC
  LIMIT 1
)
WHERE b.rancho_id IS NULL
  AND EXISTS (
    SELECT 1 FROM historial_propiedad hp
    WHERE hp.bovino_id = b.id
      AND hp.fecha_fin IS NULL
      AND hp.rancho_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS bovinos_rancho_activo_idx
  ON bovinos (rancho_id, usuario_id);
CREATE INDEX IF NOT EXISTS bovinos_created_by_idx
  ON bovinos (created_by_user_id);

CREATE TABLE IF NOT EXISTS rancho_duenos (
  rancho_id INTEGER NOT NULL REFERENCES ranchos(id) ON DELETE CASCADE,
  dueno_id INTEGER NOT NULL REFERENCES duenos(id) ON DELETE CASCADE,
  created_by_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rancho_id, dueno_id)
);

CREATE INDEX IF NOT EXISTS rancho_duenos_dueno_idx
  ON rancho_duenos (dueno_id, rancho_id);

CREATE TABLE IF NOT EXISTS bovino_duenos (
  bovino_id INTEGER NOT NULL REFERENCES bovinos(id) ON DELETE CASCADE,
  dueno_id INTEGER NOT NULL REFERENCES duenos(id) ON DELETE CASCADE,
  created_by_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bovino_id, dueno_id)
);

CREATE INDEX IF NOT EXISTS bovino_duenos_dueno_idx
  ON bovino_duenos (dueno_id, bovino_id);

INSERT INTO rancho_duenos (rancho_id, dueno_id, created_by_user_id)
SELECT r.id, r.dueno_id, r.usuario_id
FROM ranchos r
WHERE r.dueno_id IS NOT NULL
ON CONFLICT (rancho_id, dueno_id) DO NOTHING;

INSERT INTO bovino_duenos (bovino_id, dueno_id, created_by_user_id)
SELECT DISTINCT hp.bovino_id, hp.dueno_id, b.usuario_id
FROM historial_propiedad hp
JOIN bovinos b ON b.id = hp.bovino_id
WHERE hp.fecha_fin IS NULL AND hp.dueno_id IS NOT NULL
ON CONFLICT (bovino_id, dueno_id) DO NOTHING;

-- Catalogo sanitario minimo para la evaluacion de venta vigente.
INSERT INTO vacunas (usuario_id, nombre, descripcion)
SELECT u.id, required.nombre, required.descripcion
FROM usuarios u
CROSS JOIN (VALUES
  ('Brucelosis', 'Vacuna principal requerida para evaluar disponibilidad de venta.'),
  ('Rabia Paralítica Bovina', 'Vacuna principal requerida para evaluar disponibilidad de venta.'),
  ('Carbón Sintomático (Pierna Negra) y Edema Maligno', 'Vacuna principal requerida para evaluar disponibilidad de venta.')
) AS required(nombre, descripcion)
WHERE NOT EXISTS (
  SELECT 1 FROM vacunas v
  WHERE v.usuario_id = u.id AND LOWER(v.nombre) = LOWER(required.nombre)
);

COMMIT;
