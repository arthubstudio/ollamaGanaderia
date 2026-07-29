CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- USUARIOS
-- =====================================================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'usuario',
    directory_key UUID NOT NULL DEFAULT gen_random_uuid(),
    security_locked_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX usuarios_directory_key_uq ON usuarios(directory_key);

-- =====================================================
-- BOVINOS
-- =====================================================
CREATE TABLE bovinos (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id),
    numero_arete VARCHAR(50) NOT NULL,
    nombre VARCHAR(100),
    raza VARCHAR(100),
    sexo VARCHAR(20),
    fecha_nacimiento DATE,
    estado VARCHAR(50) DEFAULT 'activa',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX bovinos_usuario_id_idx ON bovinos(usuario_id);
CREATE UNIQUE INDEX bovinos_usuario_arete_uq ON bovinos(usuario_id, UPPER(numero_arete));

CREATE TABLE bovino_arete_sequences (
    usuario_id INT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    last_value INT NOT NULL CHECK (last_value >= 0),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_sessions (
    id_hash CHAR(64) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent_hash CHAR(64)
);

CREATE INDEX auth_sessions_user_active_idx
ON auth_sessions (user_id, expires_at)
WHERE revoked_at IS NULL;

-- =====================================================
-- DUEÑOS
-- =====================================================
CREATE TABLE duenos (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id),
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(50),
    direccion TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX duenos_usuario_id_idx ON duenos(usuario_id);

-- =====================================================
-- RANCHOS
-- =====================================================
CREATE TABLE ranchos (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id),
    nombre VARCHAR(100),
    ubicacion TEXT,
    dueno_id INT REFERENCES duenos(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ranchos_usuario_id_idx ON ranchos(usuario_id);
CREATE INDEX ranchos_dueno_id_idx ON ranchos(dueno_id);

-- =====================================================
-- HISTORIAL DE PROPIEDAD
-- =====================================================
CREATE TABLE historial_propiedad (
    id SERIAL PRIMARY KEY,
    bovino_id INT REFERENCES bovinos(id),
    dueno_id INT REFERENCES duenos(id),
    rancho_id INT REFERENCES ranchos(id),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    observaciones TEXT
);

CREATE INDEX historial_propiedad_bovino_id_idx ON historial_propiedad(bovino_id);

-- =====================================================
-- VACUNAS
-- =====================================================
CREATE TABLE vacunas (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    UNIQUE (usuario_id, nombre)
);

CREATE INDEX vacunas_usuario_id_idx ON vacunas(usuario_id);

-- =====================================================
-- VACUNAS APLICADAS
-- =====================================================
CREATE TABLE vacuna_aplicada (
    id SERIAL PRIMARY KEY,
    bovino_id INT REFERENCES bovinos(id),
    vacuna_id INT REFERENCES vacunas(id),
    fecha_aplicacion DATE,
    veterinario VARCHAR(100),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX vacuna_aplicada_bovino_id_idx ON vacuna_aplicada(bovino_id);
CREATE INDEX vacuna_aplicada_vacuna_id_idx ON vacuna_aplicada(vacuna_id);

-- =====================================================
-- PESOS
-- =====================================================
CREATE TABLE pesos (
    id SERIAL PRIMARY KEY,
    bovino_id INT REFERENCES bovinos(id),
    peso DECIMAL(10,2) CHECK (peso > 0 AND peso <= 2500),
    fecha DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX pesos_bovino_id_idx ON pesos(bovino_id);

-- =====================================================
-- ENFERMEDADES
-- =====================================================
CREATE TABLE enfermedades (
    id SERIAL PRIMARY KEY,
    bovino_id INT REFERENCES bovinos(id),
    nombre VARCHAR(100),
    tratamiento TEXT,
    fecha DATE,
    veterinario VARCHAR(100)
);

CREATE INDEX enfermedades_bovino_id_idx ON enfermedades(bovino_id);

-- =====================================================
-- VENTAS
-- =====================================================
CREATE TABLE ventas (
    id SERIAL PRIMARY KEY,
    bovino_id INT REFERENCES bovinos(id),
    comprador VARCHAR(100),
    precio DECIMAL(12,2),
    fecha DATE,
    observaciones TEXT
);

CREATE INDEX ventas_bovino_id_idx ON ventas(bovino_id);

-- =====================================================
-- IA SEMÁNTICA
-- =====================================================
CREATE TABLE semantic_contexts (
    id SERIAL PRIMARY KEY,
    bovino_id INT REFERENCES bovinos(id),
    owner_user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    scope VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (scope IN ('private', 'public')),
    source VARCHAR(80) NOT NULL DEFAULT 'unknown',
    trusted BOOLEAN NOT NULL DEFAULT FALSE,
    contenido TEXT NOT NULL,
    embedding vector(768),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX semantic_contexts_bovino_id_idx ON semantic_contexts(bovino_id);

CREATE INDEX semantic_hnsw_idx
ON semantic_contexts
USING hnsw (embedding vector_cosine_ops);

-- =====================================================
-- REQUISITOS DE VENTA
-- =====================================================
CREATE TABLE requisitos_venta (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    obligatorio BOOLEAN DEFAULT true
);

INSERT INTO requisitos_venta (nombre)
VALUES
('Brucelosis'),
('Rabia'),
('Clostridiales'),
('Complejo Respiratorio');

-- =====================================================
-- RATE LIMITING PERSISTENTE
-- =====================================================
CREATE TABLE IF NOT EXISTS security_rate_limits (
    key_hash VARCHAR(160) PRIMARY KEY,
    request_count INTEGER NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_rate_limits_expires_idx
ON security_rate_limits (expires_at);
