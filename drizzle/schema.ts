import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  date,
  numeric,
  timestamp,
  vector,
  uuid
} from "drizzle-orm/pg-core";

export const aiLogs = pgTable(
  "ai_logs",
  {
    id: serial("id").primaryKey(),

    session_id: varchar(
      "session_id",
      { length: 255 }
    ),

    timestamp: timestamp(
      "timestamp"
    ).defaultNow(),

    user_prompt: text(
      "user_prompt"
    ),

    system_response: text(
      "system_response"
    ),

    ttft_ms: integer(
      "ttft_ms"
    ),

    total_latency_ms: integer(
      "total_latency_ms"
    ),

    tokens_per_second: numeric(
      "tokens_per_second"
    ),

    was_blocked: integer(
      "was_blocked"
    ),

    tools_executed: text(
      "tools_executed"
    )
  }
);

export const usuarios = pgTable(
  "usuarios",
  {

    id: serial("id")
      .primaryKey(),

    nombre: varchar(
      "nombre",
      { length: 100 }
    ).notNull(),

    email: varchar(
      "email",
      { length: 150 }
    ).notNull(),

    password_hash: text(
      "password_hash"
    ).notNull(),

    rol: varchar(
      "rol",
      { length: 50 }
    ),

    created_at: timestamp(
      "created_at"
    )

  }
);


export const conversations =
  pgTable(
    "conversations",
    {

      id: uuid("id")
        .primaryKey(),

      usuario_id:
        integer("usuario_id"),

      createdAt:
        timestamp("created_at")
        .defaultNow(),

      updatedAt:
        timestamp("updated_at")
        .defaultNow()

    }
  );

export const conversationMessages =
  pgTable(
    "conversation_messages",
    {
      id:
        serial("id")
        .primaryKey(),

      conversationId:
        uuid("conversation_id")
        .references(
          () =>
            conversations.id
        ),

      role:
        varchar("role", {
          length: 20
        }),

      content:
        text("content"),

      createdAt:
        timestamp("created_at")
        .defaultNow()
    }
  );

// =====================================
// BOVINOS
// =====================================

export const bovinos = pgTable(
  "bovinos",
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

    usuario_id: integer(
      "usuario_id"
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

    usuario_id: integer(
      "usuario_id"
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

    usuario_id: integer(
      "usuario_id"
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

      bovino_id: integer(
        "bovino_id"
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
    ),

    usuario_id: integer(
      "usuario_id"
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

      bovino_id: integer(
        "bovino_id"
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

    bovino_id: integer(
      "bovino_id"
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

      bovino_id: integer(
        "bovino_id"
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

    bovino_id: integer(
      "bovino_id"
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

      bovino_id: integer(
        "bovino_id"
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

  export const memories =
  pgTable(
    "memories",
    {

      id: serial("id")
        .primaryKey(),

      usuario_id: integer(
        "usuario_id"
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

      created_at: timestamp(
        "created_at"
      )

    }
  );