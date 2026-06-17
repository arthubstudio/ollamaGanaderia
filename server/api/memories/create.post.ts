import postgres from "postgres";
import { generarEmbedding } from "~/lib/embeddings";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

type CreateMemoryBody = {
  usuario_id?: string | number | null;
  contenido?: string;
  slot?: string | null;
  tipo?: string | null;
};

function normalizeText(value: string) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(text: string) {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function inferMemoryRecord(
  contenido: string,
  forcedSlot?: string | null,
  forcedTipo?: string | null
) {
  const raw = (contenido ?? "").trim();

  if (!raw) return null;

  const slotFromForced = forcedSlot?.trim() || null;
  const tipoFromForced = forcedTipo?.trim() || null;

  if (slotFromForced) {
    return {
      slot: slotFromForced,
      tipo: tipoFromForced || "general",
      contenido: raw,
      respuesta: "Entendido, lo recordaré."
    };
  }

  const stripPrefix = (text: string) =>
    text
      .replace(/^recuerda que\s+/i, "")
      .replace(/^recuerda\s+/i, "")
      .trim();

  const cleaned = stripPrefix(raw);
  const cleanedNormalized = normalizeText(cleaned);

  const rules: Array<{
    test: (t: string) => boolean;
    slot: (t: string) => string;
    tipo: string;
    respuesta: (t: string) => string;
  }> = [
    {
      test: (t) => /^mi vaca favorita es\s+/.test(t),
      slot: () => "vaca_favorita",
      tipo: "preferencia",
      respuesta: (t) => `Entendido, recordaré que ${t}.`
    },
    {
      test: (t) => /^mi rancho favorito es\s+/.test(t),
      slot: () => "rancho_favorito",
      tipo: "preferencia",
      respuesta: (t) => `Entendido, recordaré que ${t}.`
    },
    {
      test: (t) => /^mi proveedor favorito es\s+/.test(t),
      slot: () => "proveedor_favorito",
      tipo: "preferencia",
      respuesta: (t) => `Entendido, recordaré que ${t}.`
    },
    {
      test: (t) => /^mi dueño favorito es\s+/.test(t) || /^mi dueno favorito es\s+/.test(t),
      slot: () => "dueno_favorito",
      tipo: "preferencia",
      respuesta: (t) => `Entendido, recordaré que ${t}.`
    },
    {
      test: (t) => /^mi ([a-z0-9 _-]+?) favorito(?:a)? es\s+/.test(t),
      slot: (t) => {
        const m = t.match(/^mi ([a-z0-9 _-]+?) favorito(?:a)? es\s+(.+)$/i);
        const subject = m?.[1] ?? "preferencia";
        const subjectSlug = slug(subject);
        if (subjectSlug.includes("vaca")) return "vaca_favorita";
        if (subjectSlug.includes("rancho")) return "rancho_favorito";
        if (subjectSlug.includes("proveedor")) return "proveedor_favorito";
        if (subjectSlug.includes("dueno")) return "dueno_favorito";
        return `${subjectSlug}_favorito`;
      },
      tipo: "preferencia",
      respuesta: (t) => `Entendido, recordaré que ${t}.`
    },
    {
      test: (t) => /^mi ([a-z0-9 _-]+?) es\s+/.test(t),
      slot: (t) => {
        const m = t.match(/^mi ([a-z0-9 _-]+?) es\s+(.+)$/i);
        return slug(m?.[1] ?? "hecho");
      },
      tipo: "hecho",
      respuesta: (t) => `Entendido, recordaré que ${t}.`
    },
    {
      test: (t) => /^(me gusta(?:n)?|amo|adoro)\s+/.test(t),
      slot: () => "me_gusta",
      tipo: "gusto",
      respuesta: (t) => `Entendido, recordaré que ${t}.`
    },
    {
      test: (t) => /^(no me gusta|odio|detesto)\s+/.test(t),
      slot: () => "no_me_gusta",
      tipo: "disgusto",
      respuesta: (t) => `Entendido, recordaré que ${t}.`
    },
    {
      test: (t) => /^prefiero\s+/.test(t),
      slot: () => "preferencia",
      tipo: "preferencia",
      respuesta: (t) => `Entendido, recordaré que ${t}.`
    },
    {
      test: (t) => /^(soy|me llamo)\s+/.test(t),
      slot: () => "identidad",
      tipo: "identidad",
      respuesta: (t) => `Entendido, recordaré que ${t}.`
    },
    {
      test: (t) => /^vivo en\s+/.test(t),
      slot: () => "vivo_en",
      tipo: "ubicacion",
      respuesta: (t) => `Entendido, recordaré que ${t}.`
    },
    {
      test: (t) => /^trabajo en\s+/.test(t),
      slot: () => "trabajo_en",
      tipo: "ocupacion",
      respuesta: (t) => `Entendido, recordaré que ${t}.`
    },
    {
      test: (t) => /^(.+?)\s+odia\s+a\s+(.+)$/.test(t),
      slot: (t) => {
        const m = t.match(/^(.+?)\s+odia\s+a\s+(.+)$/i);
        const subject = slug(m?.[1] ?? "alguien");
        const target = slug(m?.[2] ?? "algo");
        return `rel_${subject}_odia_${target}`;
      },
      tipo: "relacion",
      respuesta: (t) => `Entendido, recordaré que ${t}.`
    }
  ];

  for (const rule of rules) {
    if (rule.test(cleanedNormalized)) {
      return {
        slot: rule.slot(cleanedNormalized),
        tipo: rule.tipo,
        contenido: cleaned,
        respuesta: rule.respuesta(cleaned)
      };
    }
  }

  if (
    cleanedNormalized.startsWith("recuerda que ") ||
    cleanedNormalized.startsWith("recuerda ") ||
    cleanedNormalized.startsWith("mi ") ||
    cleanedNormalized.startsWith("me gusta") ||
    cleanedNormalized.startsWith("no me gusta") ||
    cleanedNormalized.startsWith("odio") ||
    cleanedNormalized.startsWith("prefiero") ||
    cleanedNormalized.startsWith("soy ") ||
    cleanedNormalized.startsWith("me llamo") ||
    cleanedNormalized.startsWith("vivo en") ||
    cleanedNormalized.startsWith("trabajo en")
  ) {
    return {
      slot: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tipo: "general",
      contenido: cleaned,
      respuesta: `Entendido, recordaré: ${cleaned}.`
    };
  }

  return {
    slot: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tipo: tipoFromForced || "general",
    contenido: raw,
    respuesta: `Entendido, recordaré: ${raw}.`
  };
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as CreateMemoryBody;

  const usuarioId =
    body.usuario_id != null
      ? Number(body.usuario_id)
      : null;

  const contenido = (body.contenido ?? "").trim();

  if (!usuarioId || !contenido) {
    throw createError({
      statusCode: 400,
      statusMessage: "Faltan usuario_id o contenido"
    });
  }

  const inferred = inferMemoryRecord(
    contenido,
    body.slot,
    body.tipo
  );

  if (!inferred) {
    throw createError({
      statusCode: 400,
      statusMessage: "No se pudo interpretar la memoria"
    });
  }

  const embedding = await generarEmbedding(inferred.contenido);
  const vector = `[${embedding.join(",")}]`;

  await sql`
    INSERT INTO memories (
      usuario_id,
      slot,
      tipo,
      contenido,
      embedding,
      updated_at
    )
    VALUES (
      ${usuarioId},
      ${inferred.slot},
      ${inferred.tipo},
      ${inferred.contenido},
      ${vector}::vector,
      NOW()
    )
    ON CONFLICT (usuario_id, slot)
    DO UPDATE SET
      tipo = EXCLUDED.tipo,
      contenido = EXCLUDED.contenido,
      embedding = EXCLUDED.embedding,
      updated_at = NOW()
  `;

  return {
    ok: true,
    slot: inferred.slot,
    tipo: inferred.tipo,
    contenido: inferred.contenido
  };
});