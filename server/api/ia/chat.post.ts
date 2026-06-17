import postgres from "postgres";
import ollama from "ollama";
import { generarEmbedding } from "~/lib/embeddings";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

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

function hasAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase));
}

type ChatBody = {
  pregunta?: string;
  conversation_id?: string | number | null;
  usuario_id?: string | number | null;
};

type ConversationMessage = {
  role: string;
  content: string;
};

type MemoryRow = {
  contenido: string;
  distancia: number | string;
  slot?: string | null;
  tipo?: string | null;
};

function directMemorySlotFromQuestion(question: string) {
  const q = normalizeText(question);

  if (q.includes("vaca favorita")) return "vaca_favorita";
  if (q.includes("rancho favorito")) return "rancho_favorito";
  if (q.includes("dueno favorito") || q.includes("dueño favorito")) return "dueno_favorito";
  if (q.includes("me gusta")) return "me_gusta";
  if (q.includes("no me gusta")) return "no_me_gusta";
  if (q.includes("prefiero")) return "preferencia";
  if (q.includes("odio")) return "odio";
  if (q.includes("soy") || q.includes("me llamo")) return "identidad";
  if (q.includes("vivo en")) return "vivo_en";
  if (q.includes("trabajo en")) return "trabajo_en";

  return null;
}

function formatMemoryAnswer(slot: string, contenido: string) {
  const value = contenido.trim();

  switch (slot) {
    case "vaca_favorita":
      return `Tu vaca favorita es ${value.replace(/^mi vaca favorita es\s+/i, "").trim()}.`;
    case "rancho_favorito":
      return `Tu rancho favorito es ${value.replace(/^mi rancho favorito es\s+/i, "").trim()}.`;
    case "dueno_favorito":
      return `Tu dueño favorito es ${value.replace(/^mi dueño favorito es\s+/i, "").replace(/^mi dueno favorito es\s+/i, "").trim()}.`;
    case "me_gusta":
      return `Recuerdo que te gusta ${value.replace(/^(me gusta(?:n)?|amo|adoro)\s+/i, "").trim()}.`;
    case "no_me_gusta":
      return `Recuerdo que no te gusta ${value.replace(/^(no me gusta|odio|detesto)\s+/i, "").trim()}.`;
    case "preferencia":
      return `Recuerdo que prefieres ${value.replace(/^prefiero\s+/i, "").trim()}.`;
    case "identidad":
      return `Recuerdo que ${value.replace(/^(soy|me llamo)\s+/i, "").trim()}.`;
    case "vivo_en":
      return `Recuerdo que vives en ${value.replace(/^vivo en\s+/i, "").trim()}.`;
    case "trabajo_en":
      return `Recuerdo que trabajas en ${value.replace(/^trabajo en\s+/i, "").trim()}.`;
    case "odio":
      return `Recuerdo que odias ${value.replace(/^.*?odia\s+a\s+/i, "").trim()}.`;
    default:
      return `Recuerdo lo siguiente: ${value}`;
  }
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as ChatBody;

  const preguntaOriginal = body.pregunta ?? "";
  const preguntaNormalizada = normalizeText(preguntaOriginal);

  const conversationId = body.conversation_id
    ? String(body.conversation_id)
    : null;

  const usuarioId = body.usuario_id
    ? Number(body.usuario_id)
    : null;

  const historialDesc: ConversationMessage[] = conversationId
    ? await sql`
      SELECT role, content
      FROM conversation_messages
      WHERE conversation_id = ${conversationId}
      ORDER BY id DESC
      LIMIT 20
    `
    : [];

  const historial = historialDesc.slice().reverse();
  const contextoConversacion = historial.length
    ? historial.map((m: any) => `${m.role}: ${m.content}`).join("\n")
    : "";

  const esConsultaMemoriaGeneral = hasAny(preguntaNormalizada, [
    "que recuerdas de mi",
    "qué recuerdas de mí",
    "que sabes de mi",
    "qué sabes de mí",
    "que sabes sobre mi",
    "qué sabes sobre mí",
    "que recuerdas",
    "qué recuerdas"
  ]);

  const slotConsulta = directMemorySlotFromQuestion(preguntaNormalizada);

  if (usuarioId) {
    if (esConsultaMemoriaGeneral) {
      const memories = await sql`
        SELECT slot, contenido, tipo, updated_at
        FROM memories
        WHERE usuario_id = ${usuarioId}
        ORDER BY updated_at DESC, id DESC
        LIMIT 20
      `;

      if (!memories.length) {
        return {
          respuesta: "No tengo recuerdos almacenados sobre ti.",
          contexto: null,
          memorias: null,
          historial: contextoConversacion || null
        };
      }

      const lista = memories
        .map((m: any) => `• ${m.contenido}`)
        .join("\n");

      return {
        respuesta: `Recuerdo lo siguiente:\n\n${lista}`,
        contexto: null,
        memorias: lista,
        historial: contextoConversacion || null
      };
    }

    if (slotConsulta) {
      const memory = await sql`
        SELECT slot, contenido
        FROM memories
        WHERE usuario_id = ${usuarioId}
          AND slot = ${slotConsulta}
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `;

      if (memory.length) {
        return {
          respuesta: formatMemoryAnswer(
            slotConsulta,
            memory[0].contenido
          ),
          contexto: null,
          memorias: memory[0].contenido,
          historial: contextoConversacion || null
        };
      }
    }
  }

  // =====================================================
  // EMBEDDING
  // =====================================================

  const embedding = await generarEmbedding(preguntaOriginal);
  const vector = `[${embedding.join(",")}]`;

  // =====================================================
  // VECTOR SEARCH GANADERO
  // =====================================================

  const resultados: MemoryRow[] = await sql`
    SELECT
      contenido,
      embedding <=> ${vector}::vector AS distancia
    FROM semantic_contexts
    ORDER BY distancia ASC
    LIMIT 3
  `;

  const mejorResultado = resultados[0];

  const tieneContextoRelevante =
    !!mejorResultado && Number(mejorResultado.distancia) <= 0.45;

  const contextoGanadero = tieneContextoRelevante
    ? resultados.map((r: any) => r.contenido).join("\n")
    : "";

  // =====================================================
  // MEMORIAS DEL USUARIO
  // =====================================================

  const memoriasCrudas: MemoryRow[] = usuarioId
    ? await sql`
      SELECT
        slot,
        tipo,
        contenido,
        embedding <=> ${vector}::vector AS distancia
      FROM memories
      WHERE usuario_id = ${usuarioId}
      ORDER BY distancia ASC
      LIMIT 5
    `
    : [];

  const memoriasRelevantes = memoriasCrudas.filter(
    (m: any) => Number(m.distancia) <= 0.80
  );

  const contextoMemorias = memoriasRelevantes.length
    ? memoriasRelevantes.map((m: any) => m.contenido).join("\n")
    : "";

  if (!tieneContextoRelevante && !contextoConversacion && !contextoMemorias) {
    return {
      respuesta: "No encontré información relacionada en el sistema.",
      contexto: null,
      memorias: null,
      historial: null
    };
  }

  // =====================================================
  // LLM
  // =====================================================

  const response = await ollama.chat({
    model: "llama3.2:latest",
    options: {
      temperature: 0,
      top_p: 0.1
    },
    messages: [
      {
        role: "system",
        content: `
Eres un sistema privado de gestión ganadera con memoria personal por usuario.

REGLAS OBLIGATORIAS:

- Usa primero las MEMORIAS DEL USUARIO si existen.
- Usa el CONTEXTO GANADERO si existe.
- Usa el HISTORIAL DE CONVERSACIÓN si ayuda a responder.
- NO inventes información.
- NO uses conocimiento externo.
- NO expliques conceptos generales.
- Si la pregunta no está relacionada con las memorias, el contexto ni el historial, responde exactamente:
  "No encontré información relacionada en el sistema."

- Responde breve, clara y natural.
`
      },
      {
        role: "user",
        content: `
MEMORIAS DEL USUARIO:

${contextoMemorias || "Sin memorias relevantes."}

CONTEXTO GANADERO:

${contextoGanadero || "Sin contexto ganadero relevante."}

HISTORIAL DE CONVERSACIÓN:

${contextoConversacion || "Sin historial previo."}

PREGUNTA ACTUAL:

${preguntaOriginal}

RESPUESTA:
`
      }
    ]
  });

  const respuestaFinal =
    response.message?.content?.trim() ||
    "No encontré información relacionada en el sistema.";

  return {
    respuesta: respuestaFinal,
    contexto: contextoGanadero || null,
    memorias: contextoMemorias || null,
    historial: contextoConversacion || null
  };
});