import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  date,
  numeric,
  timestamp,
  vector
} from "drizzle-orm/pg-core";



// =====================================
// VACAS
// =====================================

export const vacas = pgTable(
  "vacas",
  {

    id: serial("id")
      .primaryKey(),

    numero_arete: varchar(
      "numero_arete",
      { length: 50 }
    ),

    nombre: varchar(
      "nombre",
      { length: 100 }
    ),

    raza: varchar(
      "raza",
      { length: 100 }
    ),

    sexo: varchar(
      "sexo",
      { length: 20 }
    ),

    fecha_nacimiento: date(
      "fecha_nacimiento"
    ),

    estado: varchar(
      "estado",
      { length: 50 }
    ),

    created_at: timestamp(
      "created_at"
    ),

    updated_at: timestamp(
      "updated_at"
    )

  }
);



// =====================================
// DUEÑOS
// =====================================

export const duenos = pgTable(
  "duenos",
  {

    id: serial("id")
      .primaryKey(),

    nombre: varchar(
      "nombre",
      { length: 100 }
    ),

    telefono: varchar(
      "telefono",
      { length: 50 }
    ),

    direccion: text(
      "direccion"
    ),

    created_at: timestamp(
      "created_at"
    )

  }
);



// =====================================
// RANCHOS
// =====================================

export const ranchos = pgTable(
  "ranchos",
  {

    id: serial("id")
      .primaryKey(),

    nombre: varchar(
      "nombre",
      { length: 100 }
    ),

    ubicacion: text(
      "ubicacion"
    ),

    dueno_id: integer(
      "dueno_id"
    ),

    created_at: timestamp(
      "created_at"
    )

  }
);



// =====================================
// HISTORIAL PROPIEDAD
// =====================================

export const historialPropiedad =
  pgTable(
    "historial_propiedad",
    {

      id: serial("id")
        .primaryKey(),

      vaca_id: integer(
        "vaca_id"
      ),

      dueno_id: integer(
        "dueno_id"
      ),

      rancho_id: integer(
        "rancho_id"
      ),

      fecha_inicio: date(
        "fecha_inicio"
      ),

      fecha_fin: date(
        "fecha_fin"
      ),

      observaciones: text(
        "observaciones"
      )

    }
  );



// =====================================
// VACUNAS
// =====================================

export const vacunas = pgTable(
  "vacunas",
  {

    id: serial("id")
      .primaryKey(),

    nombre: varchar(
      "nombre",
      { length: 100 }
    ),

    descripcion: text(
      "descripcion"
    )

  }
);



// =====================================
// VACUNAS APLICADAS
// =====================================

export const vacunaAplicada =
  pgTable(
    "vacuna_aplicada",
    {

      id: serial("id")
        .primaryKey(),

      vaca_id: integer(
        "vaca_id"
      ),

      vacuna_id: integer(
        "vacuna_id"
      ),

      fecha_aplicacion: date(
        "fecha_aplicacion"
      ),

      veterinario: varchar(
        "veterinario",
        { length: 100 }
      ),

      observaciones: text(
        "observaciones"
      ),

      created_at: timestamp(
        "created_at"
      )

    }
  );



// =====================================
// PESOS
// =====================================

export const pesos = pgTable(
  "pesos",
  {

    id: serial("id")
      .primaryKey(),

    vaca_id: integer(
      "vaca_id"
    ),

    peso: numeric(
      "peso"
    ),

    fecha: date(
      "fecha"
    ),

    created_at: timestamp(
      "created_at"
    )

  }
);



// =====================================
// ENFERMEDADES
// =====================================

export const enfermedades =
  pgTable(
    "enfermedades",
    {

      id: serial("id")
        .primaryKey(),

      vaca_id: integer(
        "vaca_id"
      ),

      nombre: varchar(
        "nombre",
        { length: 100 }
      ),

      tratamiento: text(
        "tratamiento"
      ),

      fecha: date(
        "fecha"
      ),

      veterinario: varchar(
        "veterinario",
        { length: 100 }
      )

    }
  );



// =====================================
// VENTAS
// =====================================

export const ventas = pgTable(
  "ventas",
  {

    id: serial("id")
      .primaryKey(),

    vaca_id: integer(
      "vaca_id"
    ),

    comprador: varchar(
      "comprador",
      { length: 100 }
    ),

    precio: numeric(
      "precio"
    ),

    fecha: date(
      "fecha"
    ),

    observaciones: text(
      "observaciones"
    )

  }
);



// =====================================
// IA SEMÁNTICA
// =====================================

export const semanticContexts =
  pgTable(
    "semantic_contexts",
    {

      id: serial("id")
        .primaryKey(),

      vaca_id: integer(
        "vaca_id"
      ),

      contenido: text(
        "contenido"
      ),

      embedding: vector(
        "embedding",
        {
          dimensions: 768
        }
      ),

      updated_at: timestamp(
        "updated_at"
      )

    }
  );