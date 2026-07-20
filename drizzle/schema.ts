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
  uuid,
  boolean,
  bigint,
  bigserial,
  jsonb,
  primaryKey
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
    ),

    selected_agent: varchar("selected_agent", { length: 32 }),
    intent: varchar("intent", { length: 100 }),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    route_reason: text("route_reason"),
    context_sources: text("context_sources"),
    retrieved_count: integer("retrieved_count").default(0),
    reranked_count: integer("reranked_count").default(0),
    reranker_used: integer("reranker_used").default(0),
    retrieval_latency_ms: integer("retrieval_latency_ms").default(0),
    rerank_latency_ms: integer("rerank_latency_ms").default(0)
  }
);

export const stressSeedBatches = pgTable("stress_seed_batches", {
  batch_key: varchar("batch_key", { length: 80 }).primaryKey(),
  usuario_id: integer("usuario_id").notNull(),
  requested_count: integer("requested_count").notNull(),
  inserted_count: integer("inserted_count").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("running"),
  started_at: timestamp("started_at").defaultNow(),
  completed_at: timestamp("completed_at")
});

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

export const breeds = pgTable("breeds", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 120 }).notNull(),
  nombre_cientifico: varchar("nombre_cientifico", { length: 160 }),
  pais_origen: varchar("pais_origen", { length: 120 }),
  tipo: varchar("tipo", { length: 30 }).notNull().default("doble_proposito"),
  descripcion: text("descripcion"),
  activo: boolean("activo").notNull().default(true),
  es_global: boolean("es_global").notNull().default(true),
  created_by: integer("created_by").references(() => usuarios.id),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

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

    rancho_id: integer("rancho_id"),

    created_by_user_id: integer("created_by_user_id")
      .references(() => usuarios.id),

    breed_id: integer("breed_id")
      .references(() => breeds.id),

    created_at: timestamp(
      "created_at"
    ),

    updated_at: timestamp(
      "updated_at"
    )

  }
);

export const bovinoAreteSequences = pgTable(
  "bovino_arete_sequences",
  {
    usuario_id: integer("usuario_id").primaryKey(),
    last_value: integer("last_value").notNull(),
    updated_at: timestamp("updated_at").defaultNow()
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

export const ranchoDuenos = pgTable("rancho_duenos", {
  rancho_id: integer("rancho_id").notNull().references(() => ranchos.id),
  dueno_id: integer("dueno_id").notNull().references(() => duenos.id),
  created_by_user_id: integer("created_by_user_id").references(() => usuarios.id),
  created_at: timestamp("created_at").notNull().defaultNow()
}, (table) => [primaryKey({ columns: [table.rancho_id, table.dueno_id] })]);

export const bovinoDuenos = pgTable("bovino_duenos", {
  bovino_id: integer("bovino_id").notNull().references(() => bovinos.id),
  dueno_id: integer("dueno_id").notNull().references(() => duenos.id),
  created_by_user_id: integer("created_by_user_id").references(() => usuarios.id),
  created_at: timestamp("created_at").notNull().defaultNow()
}, (table) => [primaryKey({ columns: [table.bovino_id, table.dueno_id] })]);



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
      ),

      propietario_usuario_id: integer("propietario_usuario_id")
        .references(() => usuarios.id),

      transfer_id: bigint("transfer_id", { mode: "number" })

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
      ).notNull(),

      proxima_fecha_permitida: date("proxima_fecha_permitida").notNull(),

      aplicada_por_usuario_id: integer("aplicada_por_usuario_id")
        .notNull()
        .references(() => usuarios.id),

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

      bovino_id: integer("bovino_id")
        .references(() => bovinos.id),

      slot: text(
        "slot"
      ).notNull(),

      tipo: text(
        "tipo"
      ).notNull(),

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
      ),

      updated_at: timestamp(
        "updated_at"
      )

    }
  );

export const bovinoTransfers = pgTable("bovino_transfers", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  bovino_id: integer("bovino_id").notNull().references(() => bovinos.id),
  source_user_id: integer("source_user_id").notNull().references(() => usuarios.id),
  destination_user_id: integer("destination_user_id").notNull().references(() => usuarios.id),
  source_rancho_id: integer("source_rancho_id").references(() => ranchos.id),
  destination_rancho_id: integer("destination_rancho_id").references(() => ranchos.id),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  message: text("message"),
  source_arete: varchar("source_arete", { length: 50 }),
  destination_arete: varchar("destination_arete", { length: 50 }),
  requested_at: timestamp("requested_at").defaultNow(),
  responded_at: timestamp("responded_at"),
  expires_at: timestamp("expires_at").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

export const bovinoTransferEvents = pgTable("bovino_transfer_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  transfer_id: bigint("transfer_id", { mode: "number" }).notNull()
    .references(() => bovinoTransfers.id),
  bovino_id: integer("bovino_id").notNull().references(() => bovinos.id),
  actor_user_id: integer("actor_user_id").references(() => usuarios.id),
  event_type: varchar("event_type", { length: 30 }).notNull(),
  from_user_id: integer("from_user_id").references(() => usuarios.id),
  to_user_id: integer("to_user_id").references(() => usuarios.id),
  metadata: jsonb("metadata").notNull().default({}),
  created_at: timestamp("created_at").defaultNow()
});

export const notifications = pgTable("notifications", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  user_id: integer("user_id").notNull().references(() => usuarios.id),
  actor_user_id: integer("actor_user_id").references(() => usuarios.id),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body").notNull(),
  entity_type: varchar("entity_type", { length: 50 }),
  entity_id: varchar("entity_id", { length: 100 }),
  data: jsonb("data").notNull().default({}),
  created_at: timestamp("created_at").defaultNow()
});

export const notificationReads = pgTable("notification_reads", {
  notification_id: bigint("notification_id", { mode: "number" }).notNull()
    .references(() => notifications.id),
  user_id: integer("user_id").notNull().references(() => usuarios.id),
  read_at: timestamp("read_at").defaultNow()
}, (table) => [primaryKey({ columns: [table.notification_id, table.user_id] })]);

export const friendRequests = pgTable("friend_requests", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  sender_user_id: integer("sender_user_id").notNull().references(() => usuarios.id),
  receiver_user_id: integer("receiver_user_id").notNull().references(() => usuarios.id),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  message: varchar("message", { length: 500 }),
  created_at: timestamp("created_at").defaultNow(),
  responded_at: timestamp("responded_at")
});

export const friendships = pgTable("friendships", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  user_low_id: integer("user_low_id").notNull().references(() => usuarios.id),
  user_high_id: integer("user_high_id").notNull().references(() => usuarios.id),
  created_from_request_id: bigint("created_from_request_id", { mode: "number" })
    .references(() => friendRequests.id),
  created_at: timestamp("created_at").defaultNow()
});

export const communityConversations = pgTable("community_conversations", {
  id: uuid("id").primaryKey(),
  kind: varchar("kind", { length: 20 }).notNull().default("direct"),
  created_by: integer("created_by").notNull().references(() => usuarios.id),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

export const communityConversationMembers = pgTable("community_conversation_members", {
  conversation_id: uuid("conversation_id").notNull()
    .references(() => communityConversations.id),
  user_id: integer("user_id").notNull().references(() => usuarios.id),
  joined_at: timestamp("joined_at").defaultNow(),
  last_read_message_id: bigint("last_read_message_id", { mode: "number" })
}, (table) => [primaryKey({ columns: [table.conversation_id, table.user_id] })]);

export const communityMessages = pgTable("community_messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  conversation_id: uuid("conversation_id").notNull()
    .references(() => communityConversations.id),
  sender_user_id: integer("sender_user_id").notNull().references(() => usuarios.id),
  content: text("content").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  edited_at: timestamp("edited_at"),
  deleted_at: timestamp("deleted_at")
});

export const activityAuditLogs = pgTable("activity_audit_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  actor_user_id: integer("actor_user_id").references(() => usuarios.id),
  action: varchar("action", { length: 100 }).notNull(),
  entity_type: varchar("entity_type", { length: 60 }).notNull(),
  entity_id: varchar("entity_id", { length: 100 }),
  success: boolean("success").notNull().default(true),
  duration_ms: integer("duration_ms"),
  metadata: jsonb("metadata").notNull().default({}),
  created_at: timestamp("created_at").defaultNow()
});
