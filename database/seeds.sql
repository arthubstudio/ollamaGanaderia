BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- USUARIOS
-- =====================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- CONVERSACIONES
-- =====================================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- MEMORIAS
-- =====================================================
CREATE TABLE IF NOT EXISTS memories (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    slot TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'general',
    contenido TEXT NOT NULL,
    embedding vector(768),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS memories_usuario_slot_uq
ON memories (usuario_id, slot);

-- =====================================================
-- DUEÑOS
-- =====================================================
CREATE TABLE IF NOT EXISTS duenos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(50),
    direccion TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS duenos_usuario_id_idx
ON duenos(usuario_id);

-- =====================================================
-- RANCHOS
-- =====================================================
CREATE TABLE IF NOT EXISTS ranchos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    nombre VARCHAR(100),
    ubicacion TEXT,
    dueno_id INT REFERENCES duenos(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ranchos_usuario_id_idx
ON ranchos(usuario_id);

-- =====================================================
-- VACAS
-- =====================================================
CREATE TABLE IF NOT EXISTS vacas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    numero_arete VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100),
    raza VARCHAR(100),
    sexo VARCHAR(20),
    fecha_nacimiento DATE,
    estado VARCHAR(50) DEFAULT 'activa',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vacas_usuario_id_idx
ON vacas(usuario_id);

-- =====================================================
-- HISTORIAL DE PROPIEDAD
-- =====================================================
CREATE TABLE IF NOT EXISTS historial_propiedad (
    id SERIAL PRIMARY KEY,
    vaca_id INT REFERENCES vacas(id) ON DELETE CASCADE,
    dueno_id INT REFERENCES duenos(id),
    rancho_id INT REFERENCES ranchos(id),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    observaciones TEXT
);

CREATE INDEX IF NOT EXISTS historial_propiedad_vaca_id_idx
ON historial_propiedad(vaca_id);

-- =====================================================
-- VACUNAS
-- =====================================================
CREATE TABLE IF NOT EXISTS vacunas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT
);

CREATE INDEX IF NOT EXISTS vacunas_usuario_id_idx
ON vacunas(usuario_id);

-- =====================================================
-- VACUNAS APLICADAS
-- =====================================================
CREATE TABLE IF NOT EXISTS vacuna_aplicada (
    id SERIAL PRIMARY KEY,
    vaca_id INT REFERENCES vacas(id) ON DELETE CASCADE,
    vacuna_id INT REFERENCES vacunas(id),
    fecha_aplicacion DATE,
    veterinario VARCHAR(100),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vacuna_aplicada_vaca_id_idx
ON vacuna_aplicada(vaca_id);

CREATE INDEX IF NOT EXISTS vacuna_aplicada_vacuna_id_idx
ON vacuna_aplicada(vacuna_id);

-- =====================================================
-- PESOS
-- =====================================================
CREATE TABLE IF NOT EXISTS pesos (
    id SERIAL PRIMARY KEY,
    vaca_id INT REFERENCES vacas(id) ON DELETE CASCADE,
    peso DECIMAL(10,2),
    fecha DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pesos_vaca_id_idx
ON pesos(vaca_id);

-- =====================================================
-- ENFERMEDADES
-- =====================================================
CREATE TABLE IF NOT EXISTS enfermedades (
    id SERIAL PRIMARY KEY,
    vaca_id INT REFERENCES vacas(id) ON DELETE CASCADE,
    nombre VARCHAR(100),
    tratamiento TEXT,
    fecha DATE,
    veterinario VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS enfermedades_vaca_id_idx
ON enfermedades(vaca_id);

-- =====================================================
-- VENTAS
-- =====================================================
CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    vaca_id INT REFERENCES vacas(id) ON DELETE CASCADE,
    comprador VARCHAR(100),
    precio DECIMAL(12,2),
    fecha DATE,
    observaciones TEXT
);

CREATE INDEX IF NOT EXISTS ventas_vaca_id_idx
ON ventas(vaca_id);

-- =====================================================
-- IA SEMÁNTICA
-- =====================================================
CREATE TABLE IF NOT EXISTS semantic_contexts (
    id SERIAL PRIMARY KEY,
    vaca_id INT REFERENCES vacas(id) ON DELETE CASCADE,
    contenido TEXT NOT NULL,
    embedding vector(768),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS semantic_contexts_vaca_id_idx
ON semantic_contexts(vaca_id);

CREATE INDEX IF NOT EXISTS semantic_hnsw_idx
ON semantic_contexts
USING hnsw (embedding vector_cosine_ops);

-- =====================================================
-- REQUISITOS DE VENTA
-- =====================================================
CREATE TABLE IF NOT EXISTS requisitos_venta (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    obligatorio BOOLEAN DEFAULT true
);

-- =====================================================
-- OBSERVABILIDAD IA
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_logs (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255),
    timestamp TIMESTAMP DEFAULT NOW(),
    user_prompt TEXT,
    system_response TEXT,
    ttft_ms INTEGER,
    total_latency_ms INTEGER,
    tokens_per_second NUMERIC,
    was_blocked INTEGER DEFAULT 0,
    tools_executed TEXT
);

-- =====================================================
-- DATOS DE EJEMPLO
-- =====================================================

INSERT INTO usuarios (id, nombre, email, password_hash, rol)
VALUES
(1, 'Hugo', 'hugo@ganaderia.com', 'temporal', 'admin'),
(2, 'Pedro', 'pedro@gmail.com', '123456', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO duenos (id, usuario_id, nombre, telefono, direccion)
VALUES
(1, 2, 'Juan Perez', '9991112222', 'Rancho Norte'),
(2, 2, 'Pedro Lopez', '9993334444', 'Rancho Sur')
ON CONFLICT DO NOTHING;

INSERT INTO ranchos (id, usuario_id, nombre, ubicacion, dueno_id)
VALUES
(1, 2, 'Rancho Norte', 'Yucatán', 1),
(2, 2, 'Rancho Sur', 'Mérida', 2)
ON CONFLICT DO NOTHING;

INSERT INTO vacas
(id, usuario_id, numero_arete, nombre, raza, sexo, fecha_nacimiento, estado)
VALUES
(1, 2, 'MX001', 'Lola', 'Brahman', 'Hembra', '2024-01-10', 'activa'),
(2, 2, 'MX002', 'ToroMax', 'Angus', 'Macho', '2023-11-15', 'activa'),
(3, 2, 'MX123', 'Meme', 'Freiok', 'Macho', '2024-02-20', 'activa')
ON CONFLICT (numero_arete) DO NOTHING;

INSERT INTO historial_propiedad
(id, vaca_id, dueno_id, rancho_id, fecha_inicio, fecha_fin, observaciones)
VALUES
(1, 1, 1, 1, '2025-01-01', NULL, NULL),
(2, 2, 2, 2, '2025-01-01', NULL, NULL),
(3, 3, 2, 2, '2025-01-01', NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO vacunas (id, usuario_id, nombre, descripcion)
VALUES
(1, 2, 'Brucelosis', 'Vacuna contra brucelosis'),
(2, 2, 'Rabia', 'Vacuna contra rabia'),
(3, 2, 'Clostridiales', 'Vacuna clostridial'),
(4, 2, 'Complejo Respiratorio', 'Vacuna respiratoria')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO vacuna_aplicada
(id, vaca_id, vacuna_id, fecha_aplicacion, veterinario, observaciones)
VALUES
(1, 1, 1, '2026-01-10', 'Dr. Martínez', NULL),
(2, 1, 2, '2026-02-10', 'Dr. Martínez', NULL),
(3, 2, 1, '2026-01-12', 'Dr. Pérez', NULL),
(4, 3, 2, '2025-02-21', 'Robert', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO pesos
(id, vaca_id, peso, fecha)
VALUES
(1, 1, 420, '2026-05-01'),
(2, 2, 510, '2026-05-01'),
(3, 3, 125.00, '2026-06-17')
ON CONFLICT DO NOTHING;

INSERT INTO enfermedades
(id, vaca_id, nombre, tratamiento, fecha, veterinario)
VALUES
(1, 1, 'Fiebre', 'Antibiótico y descanso', '2026-03-05', 'Dr. López'),
(2, 3, 'Gripe bovina', 'Observación y vitaminas', '2026-04-12', 'Dr. Roberto')
ON CONFLICT DO NOTHING;

INSERT INTO ventas
(id, vaca_id, comprador, precio, fecha, observaciones)
VALUES
(1, 2, 'Matadero del Centro', 28000.00, '2026-06-01', 'Venta realizada sin incidencias')
ON CONFLICT DO NOTHING;

INSERT INTO semantic_contexts
(id, vaca_id, contenido, updated_at)
VALUES
(
  1,
  1,
  'La vaca Lola raza Brahman pesa 420kg y tiene vacunación completa.',
  NOW()
),
(
  2,
  2,
  'El toro ToroMax raza Angus pesa 510kg y está listo para venta.',
  NOW()
),
(
  3,
  3,
  'Meme pesa 125 kg y pertenece al usuario Pedro.',
  NOW()
)
ON CONFLICT DO NOTHING;

INSERT INTO requisitos_venta
(id, nombre, obligatorio)
VALUES
(1, 'Brucelosis', true),
(2, 'Rabia', true),
(3, 'Clostridiales', true),
(4, 'Complejo Respiratorio', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- AJUSTE DE SECUENCIAS
-- =====================================================
SELECT setval(pg_get_serial_sequence('usuarios', 'id'), COALESCE((SELECT MAX(id) FROM usuarios), 1), true);
SELECT setval(pg_get_serial_sequence('duenos', 'id'), COALESCE((SELECT MAX(id) FROM duenos), 1), true);
SELECT setval(pg_get_serial_sequence('ranchos', 'id'), COALESCE((SELECT MAX(id) FROM ranchos), 1), true);
SELECT setval(pg_get_serial_sequence('vacas', 'id'), COALESCE((SELECT MAX(id) FROM vacas), 1), true);
SELECT setval(pg_get_serial_sequence('historial_propiedad', 'id'), COALESCE((SELECT MAX(id) FROM historial_propiedad), 1), true);
SELECT setval(pg_get_serial_sequence('vacunas', 'id'), COALESCE((SELECT MAX(id) FROM vacunas), 1), true);
SELECT setval(pg_get_serial_sequence('vacuna_aplicada', 'id'), COALESCE((SELECT MAX(id) FROM vacuna_aplicada), 1), true);
SELECT setval(pg_get_serial_sequence('pesos', 'id'), COALESCE((SELECT MAX(id) FROM pesos), 1), true);
SELECT setval(pg_get_serial_sequence('enfermedades', 'id'), COALESCE((SELECT MAX(id) FROM enfermedades), 1), true);
SELECT setval(pg_get_serial_sequence('ventas', 'id'), COALESCE((SELECT MAX(id) FROM ventas), 1), true);
SELECT setval(pg_get_serial_sequence('requisitos_venta', 'id'), COALESCE((SELECT MAX(id) FROM requisitos_venta), 1), true);
SELECT setval(pg_get_serial_sequence('semantic_contexts', 'id'), COALESCE((SELECT MAX(id) FROM semantic_contexts), 1), true);
SELECT setval(pg_get_serial_sequence('ai_logs', 'id'), COALESCE((SELECT MAX(id) FROM ai_logs), 1), true);
SELECT setval(pg_get_serial_sequence('memories', 'id'), COALESCE((SELECT MAX(id) FROM memories), 1), true);

COMMIT;