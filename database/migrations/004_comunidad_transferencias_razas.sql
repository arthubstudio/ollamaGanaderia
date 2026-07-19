BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE usuarios ALTER COLUMN rol SET DEFAULT 'usuario';

CREATE TABLE IF NOT EXISTS breeds (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    nombre_cientifico VARCHAR(160),
    pais_origen VARCHAR(120),
    tipo VARCHAR(30) NOT NULL DEFAULT 'doble_proposito'
        CHECK (tipo IN ('carne', 'leche', 'doble_proposito', 'trabajo', 'otro')),
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    es_global BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS breeds_nombre_ci_uq
ON breeds (LOWER(nombre));

CREATE INDEX IF NOT EXISTS breeds_nombre_trgm_idx
ON breeds USING GIN (nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS breeds_tipo_activo_idx
ON breeds (tipo, activo);

ALTER TABLE bovinos ADD COLUMN IF NOT EXISTS breed_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bovinos_breed_id_fk'
  ) THEN
    ALTER TABLE bovinos
      ADD CONSTRAINT bovinos_breed_id_fk
      FOREIGN KEY (breed_id) REFERENCES breeds(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bovinos_breed_id_idx ON bovinos(breed_id);

ALTER TABLE memories ADD COLUMN IF NOT EXISTS bovino_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memories_bovino_id_fk'
  ) THEN
    ALTER TABLE memories
      ADD CONSTRAINT memories_bovino_id_fk
      FOREIGN KEY (bovino_id) REFERENCES bovinos(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS memories_bovino_id_idx ON memories(bovino_id);

CREATE TABLE IF NOT EXISTS bovino_transfers (
    id BIGSERIAL PRIMARY KEY,
    bovino_id INTEGER NOT NULL REFERENCES bovinos(id) ON DELETE RESTRICT,
    source_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    destination_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    source_rancho_id INTEGER REFERENCES ranchos(id) ON DELETE SET NULL,
    destination_rancho_id INTEGER REFERENCES ranchos(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED')),
    message TEXT,
    source_arete VARCHAR(50),
    destination_arete VARCHAR(50),
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (source_user_id <> destination_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS bovino_transfers_one_pending_idx
ON bovino_transfers (bovino_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS bovino_transfers_source_idx
ON bovino_transfers (source_user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS bovino_transfers_destination_idx
ON bovino_transfers (destination_user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS bovino_transfers_status_expiry_idx
ON bovino_transfers (status, expires_at);

CREATE TABLE IF NOT EXISTS bovino_transfer_events (
    id BIGSERIAL PRIMARY KEY,
    transfer_id BIGINT NOT NULL REFERENCES bovino_transfers(id) ON DELETE CASCADE,
    bovino_id INTEGER NOT NULL REFERENCES bovinos(id) ON DELETE RESTRICT,
    actor_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    event_type VARCHAR(30) NOT NULL,
    from_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    to_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bovino_transfer_events_bovino_idx
ON bovino_transfer_events (bovino_id, created_at DESC);

ALTER TABLE historial_propiedad ADD COLUMN IF NOT EXISTS propietario_usuario_id INTEGER;
ALTER TABLE historial_propiedad ADD COLUMN IF NOT EXISTS transfer_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'historial_propiedad_usuario_fk'
  ) THEN
    ALTER TABLE historial_propiedad
      ADD CONSTRAINT historial_propiedad_usuario_fk
      FOREIGN KEY (propietario_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'historial_propiedad_transfer_fk'
  ) THEN
    ALTER TABLE historial_propiedad
      ADD CONSTRAINT historial_propiedad_transfer_fk
      FOREIGN KEY (transfer_id) REFERENCES bovino_transfers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS historial_propiedad_propietario_idx
ON historial_propiedad (propietario_usuario_id, fecha_inicio DESC);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    actor_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    read_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
    id BIGSERIAL PRIMARY KEY,
    sender_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    receiver_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
    message VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMP,
    CHECK (sender_user_id <> receiver_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_pair_uq
ON friend_requests (
  LEAST(sender_user_id, receiver_user_id),
  GREATEST(sender_user_id, receiver_user_id)
) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS friend_requests_receiver_idx
ON friend_requests (receiver_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS friendships (
    id BIGSERIAL PRIMARY KEY,
    user_low_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    user_high_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    created_from_request_id BIGINT REFERENCES friend_requests(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (user_low_id < user_high_id),
    UNIQUE (user_low_id, user_high_id)
);

CREATE INDEX IF NOT EXISTS friendships_low_idx ON friendships(user_low_id);
CREATE INDEX IF NOT EXISTS friendships_high_idx ON friendships(user_high_id);

CREATE TABLE IF NOT EXISTS community_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind VARCHAR(20) NOT NULL DEFAULT 'direct' CHECK (kind IN ('direct')),
    created_by INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_conversation_members (
    conversation_id UUID NOT NULL REFERENCES community_conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_read_message_id BIGINT,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_members_user_idx
ON community_conversation_members (user_id, conversation_id);

CREATE TABLE IF NOT EXISTS community_messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES community_conversations(id) ON DELETE CASCADE,
    sender_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    edited_at TIMESTAMP,
    deleted_at TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'community_members_last_read_fk'
  ) THEN
    ALTER TABLE community_conversation_members
      ADD CONSTRAINT community_members_last_read_fk
      FOREIGN KEY (last_read_message_id) REFERENCES community_messages(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS community_messages_conversation_idx
ON community_messages (conversation_id, id DESC);

CREATE TABLE IF NOT EXISTS activity_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(100),
    success BOOLEAN NOT NULL DEFAULT TRUE,
    duration_ms INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_audit_actor_idx
ON activity_audit_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_audit_entity_idx
ON activity_audit_logs (entity_type, entity_id, created_at DESC);

INSERT INTO breeds
  (nombre, nombre_cientifico, pais_origen, tipo, descripcion, es_global)
VALUES
  ('Aberdeen Angus', 'Bos taurus', 'Escocia', 'carne', 'Raza de carne reconocida por calidad y facilidad de manejo.', TRUE),
  ('Angus Rojo', 'Bos taurus', 'Escocia', 'carne', 'Variante roja de Angus orientada a produccion de carne.', TRUE),
  ('Beefmaster', NULL, 'Estados Unidos', 'carne', 'Raza sintetica adaptada a climas calidos.', TRUE),
  ('Belgian Blue', 'Bos taurus', 'Belgica', 'carne', 'Raza especializada en produccion de carne.', TRUE),
  ('Bonsmara', NULL, 'Sudafrica', 'carne', 'Raza de carne adaptada a condiciones subtropicales.', TRUE),
  ('Braford', NULL, 'Estados Unidos', 'carne', 'Cruza estabilizada de Brahman y Hereford.', TRUE),
  ('Brahman', 'Bos indicus', 'Estados Unidos', 'carne', 'Raza cebuina resistente al calor y parasitos.', TRUE),
  ('Brangus', NULL, 'Estados Unidos', 'carne', 'Cruza estabilizada de Brahman y Angus.', TRUE),
  ('Brown Swiss', 'Bos taurus', 'Suiza', 'leche', 'Raza lechera de alta rusticidad.', TRUE),
  ('Charbray', NULL, 'Estados Unidos', 'carne', 'Cruza estabilizada de Charolais y Brahman.', TRUE),
  ('Charolais', 'Bos taurus', 'Francia', 'carne', 'Raza de gran desarrollo muscular y rendimiento carnico.', TRUE),
  ('Chianina', 'Bos taurus', 'Italia', 'carne', 'Raza de gran talla originaria de Italia.', TRUE),
  ('Criollo Mexicano', 'Bos taurus', 'Mexico', 'doble_proposito', 'Poblaciones criollas adaptadas a regiones mexicanas.', TRUE),
  ('Dexter', 'Bos taurus', 'Irlanda', 'doble_proposito', 'Raza compacta de doble proposito.', TRUE),
  ('Droughtmaster', NULL, 'Australia', 'carne', 'Raza adaptada a sequia y calor.', TRUE),
  ('Fleckvieh', 'Bos taurus', 'Alemania', 'doble_proposito', 'Variedad Simmental de doble proposito.', TRUE),
  ('Galloway', 'Bos taurus', 'Escocia', 'carne', 'Raza rustica de carne.', TRUE),
  ('Gelbvieh', 'Bos taurus', 'Alemania', 'doble_proposito', 'Raza productiva de carne y leche.', TRUE),
  ('Girolando', NULL, 'Brasil', 'leche', 'Cruza lechera adaptada al tropico.', TRUE),
  ('Gyr', 'Bos indicus', 'India', 'leche', 'Cebu lechero adaptado a clima tropical.', TRUE),
  ('Guernsey', 'Bos taurus', 'Guernsey', 'leche', 'Raza lechera conocida por solidos lacteos.', TRUE),
  ('Hereford', 'Bos taurus', 'Inglaterra', 'carne', 'Raza de carne rustica y ampliamente distribuida.', TRUE),
  ('Highland', 'Bos taurus', 'Escocia', 'carne', 'Raza rustica de zonas frias.', TRUE),
  ('Holstein', 'Bos taurus', 'Paises Bajos', 'leche', 'Principal raza lechera de alta produccion.', TRUE),
  ('Indubrasil', 'Bos indicus', 'Brasil', 'doble_proposito', 'Cebu desarrollado en Brasil.', TRUE),
  ('Jersey', 'Bos taurus', 'Jersey', 'leche', 'Raza lechera con alto contenido de grasa.', TRUE),
  ('Limousin', 'Bos taurus', 'Francia', 'carne', 'Raza de carne con buen rendimiento de canal.', TRUE),
  ('Marchigiana', 'Bos taurus', 'Italia', 'carne', 'Raza italiana de carne.', TRUE),
  ('Montbeliarde', 'Bos taurus', 'Francia', 'leche', 'Raza lechera apta para sistemas mixtos.', TRUE),
  ('Murray Grey', 'Bos taurus', 'Australia', 'carne', 'Raza australiana de carne y temperamento docil.', TRUE),
  ('Nelore', 'Bos indicus', 'India', 'carne', 'Cebu de carne ampliamente usado en America Latina.', TRUE),
  ('Normando', 'Bos taurus', 'Francia', 'doble_proposito', 'Raza de leche y carne.', TRUE),
  ('Pardo Suizo', 'Bos taurus', 'Suiza', 'leche', 'Raza lechera rustica y longeva.', TRUE),
  ('Piedmontese', 'Bos taurus', 'Italia', 'carne', 'Raza italiana especializada en carne.', TRUE),
  ('Red Poll', 'Bos taurus', 'Inglaterra', 'doble_proposito', 'Raza mocha de doble proposito.', TRUE),
  ('Romagnola', 'Bos taurus', 'Italia', 'carne', 'Raza italiana de carne.', TRUE),
  ('Romosinuano', 'Bos taurus', 'Colombia', 'carne', 'Raza criolla adaptada al tropico.', TRUE),
  ('Salers', 'Bos taurus', 'Francia', 'doble_proposito', 'Raza rustica de doble proposito.', TRUE),
  ('Santa Gertrudis', NULL, 'Estados Unidos', 'carne', 'Raza sintetica Brahman-Shorthorn.', TRUE),
  ('Senepol', 'Bos taurus', 'Islas Virgenes', 'carne', 'Raza taurina tolerante al calor.', TRUE),
  ('Shorthorn', 'Bos taurus', 'Inglaterra', 'doble_proposito', 'Raza historica de carne y leche.', TRUE),
  ('Simbrah', NULL, 'Estados Unidos', 'carne', 'Cruza estabilizada de Simmental y Brahman.', TRUE),
  ('Simmental', 'Bos taurus', 'Suiza', 'doble_proposito', 'Raza de carne y leche de amplia distribucion.', TRUE),
  ('Simental', 'Bos taurus', 'Suiza', 'doble_proposito', 'Nombre de uso comun en espanol para Simmental.', TRUE),
  ('Sussex', 'Bos taurus', 'Inglaterra', 'carne', 'Raza britanica de carne.', TRUE),
  ('Tarentaise', 'Bos taurus', 'Francia', 'leche', 'Raza alpina lechera y rustica.', TRUE),
  ('Texas Longhorn', 'Bos taurus', 'Estados Unidos', 'carne', 'Raza rustica de grandes cuernos.', TRUE),
  ('Wagyu', 'Bos taurus', 'Japon', 'carne', 'Grupo de razas japonesas de carne marmoleada.', TRUE),
  ('White Park', 'Bos taurus', 'Reino Unido', 'carne', 'Raza britanica antigua de carne.', TRUE),
  ('Zebu', 'Bos indicus', 'Asia del Sur', 'doble_proposito', 'Denominacion general de bovinos cebuinos.', TRUE)
ON CONFLICT (LOWER(nombre)) DO NOTHING;

UPDATE bovinos b
SET breed_id = br.id
FROM breeds br
WHERE b.breed_id IS NULL
  AND LOWER(BTRIM(b.raza)) = LOWER(br.nombre);

UPDATE historial_propiedad hp
SET propietario_usuario_id = b.usuario_id
FROM bovinos b
WHERE hp.bovino_id = b.id
  AND hp.propietario_usuario_id IS NULL;

COMMIT;
