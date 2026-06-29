CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- USUARIOS
-- =====================================================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol VARCHAR(50) DEFAULT 'empleado',
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- BOVINOS
-- =====================================================
CREATE TABLE bovinos (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id),
    numero_arete VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100),
    raza VARCHAR(100),
    sexo VARCHAR(20),
    fecha_nacimiento DATE,
    estado VARCHAR(50) DEFAULT 'activa',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX bovinos_usuario_id_idx ON bovinos(usuario_id);

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
    peso DECIMAL(10,2),
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