import postgres from "postgres";
import { ollama } from "~/lib/ollama";
import { setResponseHeader } from "h3";
import {
  detectPromptInjection,
  GUARDRAIL_BLOCKED_MESSAGE
} from "~/server/lib/guardrails";
import {
  extraerConsultaEspecificaBovino,
  isWriteActionBovino
} from "~/lib/bovinoRouterHelpers";
import {
  enrichQuestionWithAnimal,
  isContextualFollowUp,
  resolveAnimalFromContext
} from "~/lib/conversationContext";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

type ChatBody = {
  pregunta?: string;
  conversation_id?: string | number | null;
  usuario_id?: string | number | null;
  stream?: boolean;
};

type ToolExecution = {
  name: string;
  status: "SUCCESS" | "ERROR";
  params?: unknown;
  result?: unknown;
  error?: string;
};

function normalizeText(value: string) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasWords(text: string, words: string[]) {
  return words.every((word) => text.includes(word));
}

function slug(text: string) {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function approxTokenCount(text: string) {
  return (text.trim().match(/\S+/g) ?? []).length;
}

function tokenizeForStreaming(text: string) {
  const parts = text.match(/\S+\s*/g);
  return parts && parts.length ? parts : [text];
}

function getKeywordsFromText(text: string) {
  const stopwords = new Set([
    "la", "el", "los", "las", "de", "del", "y", "o", "a", "al", "en",
    "que", "se", "su", "sus", "un", "una", "unos", "unas", "mi", "mis",
    "tu", "tus", "le", "les", "lo", "es", "son",
    "esta", "este", "estos", "estas", "con", "por", "para", "me",
    "te", "nos", "si", "no", "ya", "muy"
  ]);

  return normalizeText(text)
    .split(" ")
    .map((p) => p.trim())
    .filter((p) => p.length >= 3)
    .filter((p) => !stopwords.has(p));
}

function buscarMemoriasRelacionadas(pregunta: string, memories: any[]) {
  const q = normalizeText(pregunta);
  const keywordsPregunta = getKeywordsFromText(q);

  return memories.filter((m) => {
    const contenido = normalizeText(m.contenido ?? "");
    const keywordsContenido = getKeywordsFromText(contenido);

    return (
      keywordsContenido.some((k: string) => q.includes(k)) ||
      keywordsPregunta.some((k) => contenido.includes(k))
    );
  });
}

function detectMemoryWrite(text: string) {
  const raw = (text ?? "").trim();
  const normalized = normalizeText(raw);

  const cleaned = raw
    .replace(/^recuerda que\s+/i, "")
    .replace(/^recuerda\s+/i, "")
    .trim();

  const cleanedNormalized = normalizeText(cleaned);

  if (/^mi vaca favorita es\s+/.test(cleanedNormalized)) {
    return {
      slot: "vaca_favorita",
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  const invertedVacaFavorita = cleanedNormalized.match(/^(.+?)\s+es mi vaca favorita$/);
  if (invertedVacaFavorita?.[1]) {
    const nombre = invertedVacaFavorita[1].trim();
    const contenido = `Mi vaca favorita es ${nombre}`;
    return {
      slot: "vaca_favorita",
      tipo: "preferencia",
      contenido,
      respuesta: `Entendido, recordaré que ${contenido}.`
    };
  }

  if (/^mi rancho favorito es\s+/.test(cleanedNormalized)) {
    return {
      slot: "rancho_favorito",
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (/^mi proveedor favorito es\s+/.test(cleanedNormalized)) {
    return {
      slot: "proveedor_favorito",
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (
    /^mi dueño favorito es\s+/.test(cleanedNormalized) ||
    /^mi dueno favorito es\s+/.test(cleanedNormalized)
  ) {
    return {
      slot: "dueno_favorito",
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  const favoriteMatch =
    cleanedNormalized.match(/^mi ([a-z0-9 _-]+?) favorito(?:a)? es\s+(.+)$/);

  if (favoriteMatch) {
    const subject = favoriteMatch[1] ?? "preferencia";
    const subjectSlug = slug(subject);

    let slot = `${subjectSlug}_favorito`;
    if (subjectSlug.includes("vaca")) slot = "vaca_favorita";
    if (subjectSlug.includes("rancho")) slot = "rancho_favorito";
    if (subjectSlug.includes("proveedor")) slot = "proveedor_favorito";
    if (subjectSlug.includes("dueno")) slot = "dueno_favorito";

    return {
      slot,
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  const genericMatch =
    cleanedNormalized.match(/^mi ([a-z0-9 _-]+?) es\s+(.+)$/);

  if (genericMatch) {
    const subject = genericMatch[1] ?? "hecho";
    return {
      slot: slug(subject),
      tipo: "hecho",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (/^(me gusta(?:n)?|amo|adoro)\s+/.test(cleanedNormalized)) {
    return {
      slot: "me_gusta",
      tipo: "gusto",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (/^(no me gusta|odio|detesto)\s+/.test(cleanedNormalized)) {
    return {
      slot: "no_me_gusta",
      tipo: "disgusto",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (/^prefiero\s+/.test(cleanedNormalized)) {
    return {
      slot: "preferencia",
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (/^(soy|me llamo)\s+/.test(cleanedNormalized)) {
    return {
      slot: "identidad",
      tipo: "identidad",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (/^vivo en\s+/.test(cleanedNormalized)) {
    return {
      slot: "vivo_en",
      tipo: "ubicacion",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (/^trabajo en\s+/.test(cleanedNormalized)) {
    return {
      slot: "trabajo_en",
      tipo: "ocupacion",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  const relationMatch =
    cleanedNormalized.match(/^(.+?)\s+odia\s+a\s+(.+)$/);

  if (relationMatch) {
    const subject = slug(relationMatch[1] ?? "alguien");
    const target = slug(relationMatch[2] ?? "algo");

    return {
      slot: `rel_${subject}_odia_${target}`,
      tipo: "relacion",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  const factMatch = cleanedNormalized.match(
    /^(?:a\s+)?(.+?)\s+(le gusta|gusta|come|duerme|toma|prefiere|vive en|esta en|está en)\s+(.+)$/
  );

  if (factMatch) {
    const subject = slug(factMatch[1] ?? "entidad");

    return {
      slot: `fact_${subject}`,
      tipo: "hecho",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (
    normalized.startsWith("recuerda que ") ||
    normalized.startsWith("recuerda ") ||
    normalized.startsWith("mi ") ||
    normalized.startsWith("me gusta") ||
    normalized.startsWith("no me gusta") ||
    normalized.startsWith("odio") ||
    normalized.startsWith("prefiero") ||
    normalized.startsWith("soy ") ||
    normalized.startsWith("me llamo") ||
    normalized.startsWith("vivo en") ||
    normalized.startsWith("trabajo en")
  ) {
    return {
      slot: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tipo: "general",
      contenido: cleaned,
      respuesta: `Entendido, recordaré: ${cleaned}.`
    };
  }

  return null;
}

function memorySlotFromQuestion(text: string) {
  const t = normalizeText(text);

  if (/vaca[s]?\s+favorita[s]?/.test(t)) return "vaca_favorita";
  if (/rancho[s]?\s+favorito[s]?/.test(t)) return "rancho_favorito";
  if (/proveedor[s]?\s+favorito[s]?/.test(t)) return "proveedor_favorito";
  if (t.includes("dueño favorito") || t.includes("dueno favorito")) return "dueno_favorito";
  if (t.includes("me gusta")) return "me_gusta";
  if (t.includes("no me gusta")) return "no_me_gusta";
  if (t.includes("prefiero")) return "preferencia";
  if (t.includes("soy") || t.includes("me llamo")) return "identidad";
  if (t.includes("vivo en")) return "vivo_en";
  if (t.includes("trabajo en")) return "trabajo_en";

  return null;
}

function isMemoryQuestion(text: string) {
  const t = normalizeText(text);

  const recallPhrases = [
    "que recuerdas de mi",
    "que sabes de mi",
    "que sabes sobre mi",
    "que recuerdas",
    "que has guardado",
    "mis memorias",
    "mis recuerdos"
  ];

  if (recallPhrases.some((phrase) => t.includes(phrase))) {
    return true;
  }

  return (
    /vaca[s]?\s+favorita[s]?/.test(t) ||
    /rancho[s]?\s+favorito[s]?/.test(t) ||
    /proveedor[s]?\s+favorito[s]?/.test(t) ||
    t.includes("dueno favorito") ||
    t.includes("dueño favorito")
  );
}

function isWriteAction(text: string) {
  return isWriteActionBovino(text);
}

function isHelpQuestion(text: string) {
  const t = normalizeText(text);

  const phrases = [
    "que puedes hacer",
    "qué puedes hacer",
    "como me ayudas",
    "cómo me ayudas",
    "como funcionas",
    "cómo funcionas",
    "para que sirves",
    "para qué sirves",
    "que funciones tienes",
    "qué funciones tienes",
    "que informacion manejas",
    "qué información manejas",
    "que puedes consultar",
    "qué puedes consultar",
    "ayuda",
    "help",
    "que puedes hacer por mi",
    "qué puedes hacer por mí",
    "en que me puedes ayudar",
    "en qué me puedes ayudar",
    "como me puedes hacer util",
    "cómo me puedes hacer útil",
    "como me puedes hacer de utilidad",
    "en que me puedes hacer util",
    "en qué me puedes hacer útil",
    "para que me sirves",
    "para qué me sirves"
  ];

  return phrases.some((p) => t.includes(normalizeText(p)));
}

function helpAnswer() {
  return `
Soy Ganadería AI.

Puedo ayudarte con:

CONSULTAS:
• Consultar bovinos registrados (vacas y toros)
• Consultar pesos
• Consultar vacunas
• Consultar enfermedades
• Consultar dueños
• Consultar ranchos
• Consultar historial de propiedad
• Consultar ventas
• Verificar si un bovino está listo para venta
• Guardar y recordar memorias tuyas

ACCIONES (puedo hacerlo por ti):
• Registrar bovinos nuevos (vacas hembras o toros machos)
• Agregar vacunas al catálogo
• Aplicar vacunas a un bovino
• Registrar pesos
• Registrar enfermedades
• Transferir propiedad (dueño/rancho; los crea si no existen)

Ejemplos:

- ¿Cuántos bovinos tengo?
- ¿Cuánto pesa Lola?
- Registra un bovino: arete A-101, nombre Lola, raza Holstein, hembra
- Agrega la vacuna Antiaftosa al catálogo
- Aplica la vacuna Antiaftosa a Lola
- Aplícale la enfermedad tutik
- Transfiere Lola al dueño Juan del rancho La Esperanza
- Registra 320 kg para ToroMax
- Registra fiebre aftosa en Meme con tratamiento reposo
- ¿Qué recuerdas de mí?

Nota: una vaca siempre es hembra; un toro siempre es macho. Usa datos cortos y concretos al registrar.
`.trim();
}

function buildRagMessages(params: {
  preguntaOriginal: string;
  contextoMemorias: string;
  contextoGanadero: string;
  historial: { role: string; content: string }[];
}) {
  return [
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
`.trim()
    },
    {
      role: "user",
      content: `
MEMORIAS DEL USUARIO:

${params.contextoMemorias || "Sin memorias relevantes."}

CONTEXTO GANADERO:

${params.contextoGanadero || "Sin contexto ganadero relevante."}
`.trim()
    },
    ...params.historial.map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content ?? ""
    })),
    {
      role: "user",
      content: `
PREGUNTA ACTUAL:

${params.preguntaOriginal}

RESPUESTA:
`.trim()
    }
  ];
}

export default defineEventHandler(async (event) => {
  const requestStart = Date.now();
  const body = (await readBody(event)) as ChatBody;

  const conversationId =
    body.conversation_id != null
      ? String(body.conversation_id)
      : null;

  const usuarioId =
    body.usuario_id != null
      ? Number(body.usuario_id)
      : null;

  const preguntaOriginal = body.pregunta ?? "";
  const pregunta = normalizeText(preguntaOriginal);
  const wantsStream = Boolean(body.stream);
  const sessionId = conversationId ?? `user:${usuarioId ?? "anonymous"}`;
  const toolsExecuted: ToolExecution[] = [];

  if (wantsStream) {
    setResponseHeader(event, "Content-Type", "text/event-stream; charset=utf-8");
    setResponseHeader(event, "Cache-Control", "no-cache, no-transform");
    setResponseHeader(event, "Connection", "keep-alive");
    setResponseHeader(event, "X-Accel-Buffering", "no");
    event.node.res.flushHeaders?.();
  }

  const historialDesc: { role: string; content: string }[] = conversationId
    ? await sql`
        SELECT
          role,
          content
        FROM conversation_messages
        WHERE conversation_id = ${conversationId}
        ORDER BY id DESC
        LIMIT 20
      `
    : [];

  const historial = historialDesc.slice().reverse();

  async function insertConversationMessage(role: "user" | "assistant", content: string) {
    if (!conversationId) return;

    await sql`
      INSERT INTO conversation_messages (
        conversation_id,
        role,
        content
      )
      VALUES (
        ${conversationId},
        ${role},
        ${content}
      )
    `;
  }

  async function logAi(params: {
    responseText: string;
    ttftMs: number | null;
    wasBlocked: boolean;
    toolsExecuted: ToolExecution[];
  }) {
    const totalLatencyMs = Date.now() - requestStart;
    const tokenCount = approxTokenCount(params.responseText);
    const generationMs = Math.max(
      1,
      totalLatencyMs - (params.ttftMs ?? 0)
    );
    const tokensPerSecond =
      tokenCount > 0 ? tokenCount / (generationMs / 1000) : null;

    await sql`
      INSERT INTO ai_logs (
        session_id,
        timestamp,
        user_prompt,
        system_response,
        ttft_ms,
        total_latency_ms,
        tokens_per_second,
        was_blocked,
        tools_executed
      )
      VALUES (
        ${sessionId},
        NOW(),
        ${preguntaOriginal},
        ${params.responseText},
        ${params.ttftMs},
        ${totalLatencyMs},
        ${tokensPerSecond},
        ${params.wasBlocked ? 1 : 0},
        ${JSON.stringify(params.toolsExecuted)}
      )
    `;
  }

  function sseWrite(payload: unknown, eventName = "message") {
    if (!wantsStream) return;

    if (eventName === "end") {
      event.node.res.write(`event: end\ndata: done\n\n`);
      return;
    }

    event.node.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  async function streamTextAndFinish(
    tipo: string,
    texto: string,
    meta?: {
      wasBlocked?: boolean;
      ttftMs: number | null;
      tools?: ToolExecution[];
      alreadyStreamed?: boolean;
    }
  ) {
    if (conversationId) {
      await insertConversationMessage("assistant", texto);
    }

    await logAi({
      responseText: texto,
      ttftMs: meta?.ttftMs ?? null,
      wasBlocked: meta?.wasBlocked ?? false,
      toolsExecuted: meta?.tools ?? toolsExecuted
    });

    if (wantsStream) {
      if (!meta?.alreadyStreamed) {
        for (const part of tokenizeForStreaming(texto)) {
          sseWrite({ token: part });
        }
      }

      sseWrite({ estado: "" });
      sseWrite("done", "end");
      event.node.res.end();
      return;
    }

    return {
      tipo,
      respuesta: texto
    };
  }

  async function finish(
    tipo: string,
    texto: string,
    meta?: {
      wasBlocked?: boolean;
      ttftMs?: number | null;
      tools?: ToolExecution[];
      alreadyStreamed?: boolean;
    }
  ) {
    return await streamTextAndFinish(tipo, texto, meta);
  }

  try {
    if (conversationId) {
      await insertConversationMessage("user", preguntaOriginal);
    }

    // =====================================================
    // GUARDRAILS
    // =====================================================

    if (detectPromptInjection(preguntaOriginal)) {
      toolsExecuted.push({
        name: "guardrail.prompt_injection",
        status: "SUCCESS",
        params: { pregunta: preguntaOriginal },
        result: { blocked: true }
      });

      if (wantsStream) {
        sseWrite({ estado: GUARDRAIL_BLOCKED_MESSAGE });
      }

      return await finish("guardrail", GUARDRAIL_BLOCKED_MESSAGE, {
        wasBlocked: true,
        tools: toolsExecuted
      });
    }

    // =====================================================
    // MEMORIA ESCRITA
    // =====================================================

    const memoryWrite = detectMemoryWrite(preguntaOriginal);

    if (usuarioId && memoryWrite) {
      toolsExecuted.push({
        name: "memories.create",
        status: "SUCCESS",
        params: {
          usuario_id: usuarioId,
          slot: memoryWrite.slot,
          tipo: memoryWrite.tipo,
          contenido: memoryWrite.contenido
        }
      });

      try {
        const created = await $fetch("/api/memories/create", {
          method: "POST",
          body: {
            usuario_id: usuarioId,
            slot: memoryWrite.slot,
            tipo: memoryWrite.tipo,
            contenido: memoryWrite.contenido
          }
        });

        toolsExecuted[0].result = created;
      } catch (error: any) {
        toolsExecuted[0].status = "ERROR";
        toolsExecuted[0].error = String(error?.message ?? error);
      }

      if (wantsStream) sseWrite({ estado: "Guardando memoria..." });

      const memoryFailed = toolsExecuted.some(
        (t) => t.name === "memories.create" && t.status === "ERROR"
      );

      const respuestaMemoria = memoryFailed
        ? "No pude guardar la memoria. Intenta de nuevo."
        : memoryWrite.respuesta;

      return await finish("memoria", respuestaMemoria, {
        tools: toolsExecuted
      });
    }

    // =====================================================
    // CARGAR BOVINOS DEL USUARIO
    // =====================================================

    const bovinos = usuarioId
      ? await sql`
          SELECT *
          FROM bovinos
          WHERE usuario_id = ${usuarioId}
        `
      : await sql`
          SELECT *
          FROM bovinos
        `;

    const animalMatch = resolveAnimalFromContext(
      pregunta,
      bovinos,
      historial
    );

    const preguntaParaAcciones = enrichQuestionWithAnimal(
      preguntaOriginal,
      animalMatch
    );

    // =====================================================
    // ACCIONES DE ESCRITURA (function calling prioritario)
    // =====================================================

    if (isWriteAction(preguntaOriginal)) {
      if (wantsStream) {
        sseWrite({ estado: "Ejecutando acción..." });
      }

      toolsExecuted.push({
        name: "ia.function-calling",
        status: "SUCCESS",
        params: {
          pregunta: preguntaParaAcciones,
          usuario_id: usuarioId,
          conversation_id: conversationId,
          modo: "escritura"
        }
      });

      try {
        const functionResponse = await $fetch("/api/ia/function-calling", {
          method: "POST",
          body: {
            pregunta: preguntaParaAcciones,
            usuario_id: usuarioId,
            conversation_id: conversationId,
            historial,
            animal_context: animalMatch
              ? { id: animalMatch.id, nombre: animalMatch.nombre }
              : null
          }
        });

        toolsExecuted[toolsExecuted.length - 1].result = functionResponse;

        if (functionResponse?.encontrado) {
          return await finish("function-calling", functionResponse.respuesta, {
            tools: toolsExecuted
          });
        }

        if (functionResponse?.respuesta) {
          return await finish("function-calling", functionResponse.respuesta, {
            tools: toolsExecuted
          });
        }

        return await finish(
          "function-calling",
          "No pude completar la acción. Verifica los datos e intenta de nuevo.",
          { tools: toolsExecuted }
        );
      } catch (error: any) {
        toolsExecuted[toolsExecuted.length - 1].status = "ERROR";
        toolsExecuted[toolsExecuted.length - 1].error = String(error?.message ?? error);

        return await finish(
          "function-calling",
          "Ocurrió un error al ejecutar la acción. Intenta de nuevo.",
          { tools: toolsExecuted }
        );
      }
    }

    const consultaEspecifica = extraerConsultaEspecificaBovino(preguntaOriginal);

    if (consultaEspecifica && !animalMatch) {
      return await finish(
        "sql",
        `No encontré ningún bovino llamado "${consultaEspecifica}" en tu cuenta.`,
        { tools: toolsExecuted }
      );
    }

    // =====================================================
    // CONSULTA DE MEMORIA
    // =====================================================

    if (usuarioId && isMemoryQuestion(preguntaOriginal)) {
      const memoriesUsuario = await sql`
        SELECT
          slot,
          contenido,
          updated_at
        FROM memories
        WHERE usuario_id = ${usuarioId}
        ORDER BY updated_at DESC, id DESC
        LIMIT 100
      `;

      const relacionadas = buscarMemoriasRelacionadas(
        preguntaOriginal,
        memoriesUsuario
      );

      let respuestaMemoria = "";

      const memorySlot = memorySlotFromQuestion(preguntaOriginal);

      if (memorySlot) {
        const exact = memoriesUsuario.find(
          (m: any) => normalizeText(m.slot ?? "") === memorySlot
        );

        if (exact?.contenido) {
          if (memorySlot === "vaca_favorita") {
            const nombre = exact.contenido
              .replace(/^mi vaca favorita es\s+/i, "")
              .replace(/^recuerda que\s+/i, "")
              .trim();
            respuestaMemoria = `Tu vaca favorita es ${nombre}.`;
          } else if (memorySlot === "rancho_favorito") {
            const nombre = exact.contenido
              .replace(/^mi rancho favorito es\s+/i, "")
              .replace(/^recuerda que\s+/i, "")
              .trim();
            respuestaMemoria = `Tu rancho favorito es ${nombre}.`;
          } else if (memorySlot === "proveedor_favorito") {
            const nombre = exact.contenido
              .replace(/^mi proveedor favorito es\s+/i, "")
              .replace(/^recuerda que\s+/i, "")
              .trim();
            respuestaMemoria = `Tu proveedor favorito es ${nombre}.`;
          } else if (memorySlot === "dueno_favorito") {
            const nombre = exact.contenido
              .replace(/^mi dueño favorito es\s+/i, "")
              .replace(/^mi dueno favorito es\s+/i, "")
              .replace(/^recuerda que\s+/i, "")
              .trim();
            respuestaMemoria = `Tu dueño favorito es ${nombre}.`;
          } else {
            respuestaMemoria = exact.contenido;
          }
        }
      }

      if (!respuestaMemoria && relacionadas.length) {
        respuestaMemoria =
          "Esto encuentro relacionado:\n\n" +
          relacionadas
            .map((m: any) => `• ${m.contenido}`)
            .join("\n");
      }

      if (!respuestaMemoria) {
        if (!memoriesUsuario.length) {
          respuestaMemoria = "No tengo recuerdos almacenados sobre ti.";
        } else {
          respuestaMemoria =
            "Recuerdo lo siguiente:\n\n" +
            memoriesUsuario
              .map((m: any) => `• ${m.contenido}`)
              .join("\n");
        }
      }

      if (wantsStream) sseWrite({ estado: "Recuperando memorias..." });

      return await finish("memoria", respuestaMemoria, {
        tools: toolsExecuted
      });
    }

    // =====================================================
    // AYUDA GENERAL
    // =====================================================

    if (isHelpQuestion(preguntaOriginal)) {
      return await finish("ayuda", helpAnswer(), {
        tools: toolsExecuted
      });
    }

    // =====================================================
    // FILTRO GANADERO
    // =====================================================

    const palabrasGanaderas = [
      "pesa",
      "vaca",
      "vacas",
      "bovino",
      "bovinos",
      "toro",
      "toros",
      "ganado",
      "peso",
      "pesos",
      "vacuna",
      "vacunas",
      "vacunada",
      "vacunadas",
      "vacunado",
      "vacunados",
      "enfermedad",
      "enfermedades",
      "rancho",
      "ranchos",
      "dueno",
      "dueño",
      "animal",
      "animales",
      "hembra",
      "hembras",
      "macho",
      "machos",
      "arete",
      "venta",
      "ventas",
      "historial",
      "propiedad",
      "veterinario",
      "tratamiento",
      "vender",
      "activo",
      "activa",
      "baja",
      "vendida",
      "vendido",
      "crear",
      "crea",
      "agregar",
      "agrega",
      "registrar",
      "registra",
      "aplicar",
      "aplica",
      "nueva",
      "nuevo",
      "catalogo",
      "catálogo"
    ];

    const esGanadera = palabrasGanaderas.some((palabra) =>
      pregunta.includes(palabra)
    );

    const esSeguimientoContextual =
      isContextualFollowUp(pregunta) && historial.length > 0;

    if (!esGanadera && !animalMatch && !esSeguimientoContextual) {
      if (wantsStream) sseWrite({ estado: "No encontré información relacionada." });

      return await finish(
        "filtro",
        "No encontré información relacionada en el sistema.",
        { tools: toolsExecuted }
      );
    }

    if (wantsStream) sseWrite({ estado: "Buscando información..." });

    // =====================================================
    // LISTA PARA VENTA
    // =====================================================

    if (
      pregunta.includes("lista para venta") ||
      pregunta.includes("apta para la venta") ||
      pregunta.includes("lista para la venta") ||
      pregunta.includes("lista para vender") ||
      pregunta.includes("apta para venta") ||
      pregunta.includes("apta para vender") ||
      pregunta.includes("se puede vender") ||
      pregunta.includes("puede venderse") ||
      pregunta.includes("ya se puede vender") ||
      pregunta.includes("ya puede venderse") ||
      pregunta.includes("puedo venderla") ||
      pregunta.includes("puedo venderlo") ||
      pregunta.includes("esta lista para venderse") ||
      pregunta.includes("esta lista para venta") ||
      pregunta.includes("esta apta para venta") ||
      pregunta.includes("esta apta para venderse") ||
      pregunta.includes("cumple requisitos de venta") ||
      pregunta.includes("cumple con vacunas") ||
      pregunta.includes("cumple requisitos sanitarios") ||
      pregunta.includes("cumple para venta") ||
      pregunta.includes("lista para comercializacion") ||
      pregunta.includes("puede comercializarse") ||
      pregunta.includes("ya esta vacunada para venta") ||
      pregunta.includes("tiene vacunas para venta") ||
      pregunta.includes("esta preparada para venta") ||
      pregunta.includes("lista para salir al mercado") ||
      pregunta.includes("lista para traslado") ||
      pregunta.includes("lista para movilizacion") ||
      pregunta.includes("puede transportarse") ||
      pregunta.includes("cumple para movilizacion")
    ) {
      const animalParaVenta = animalMatch;

      if (!animalParaVenta) {
        return await finish("sql", "No encontré esa vaca.", {
          tools: toolsExecuted
        });
      }

      toolsExecuted.push({
        name: "ia.venta",
        status: "SUCCESS",
        params: {
          nombre: animalParaVenta.nombre
        }
      });

      const ventaResponse = await $fetch("/api/ia/venta", {
        method: "POST",
        body: {
          nombre: animalParaVenta.nombre
        }
      });

      toolsExecuted[toolsExecuted.length - 1].result = ventaResponse;

      if (wantsStream) {
        sseWrite({ estado: "Ejecutando acción..." });
      }

      return await finish("sql", ventaResponse.respuesta, {
        tools: toolsExecuted
      });
    }

    // =====================================================
    // CONTAR HEMBRAS
    // =====================================================

    if (
      hasWords(pregunta, ["cuantas", "hembras"]) ||
      hasWords(pregunta, ["cuantas", "hembra"])
    ) {
      const result = usuarioId
        ? await sql`
            SELECT COUNT(*) AS total
            FROM bovinos
            WHERE LOWER(sexo) = 'hembra'
              AND usuario_id = ${usuarioId}
          `
        : await sql`
            SELECT COUNT(*) AS total
            FROM bovinos
            WHERE LOWER(sexo) = 'hembra'
          `;

      return await finish(
        "sql",
        `Tienes ${result[0].total} bovinos hembras (vacas).`,
        { tools: toolsExecuted }
      );
    }

    // =====================================================
    // CONTAR MACHOS
    // =====================================================

    if (
      hasWords(pregunta, ["cuantos", "machos"]) ||
      hasWords(pregunta, ["cuantos", "macho"])
    ) {
      const result = usuarioId
        ? await sql`
            SELECT COUNT(*) AS total
            FROM bovinos
            WHERE LOWER(sexo) = 'macho'
              AND usuario_id = ${usuarioId}
          `
        : await sql`
            SELECT COUNT(*) AS total
            FROM bovinos
            WHERE LOWER(sexo) = 'macho'
          `;

      return await finish(
        "sql",
        `Tienes ${result[0].total} bovinos machos (toros).`,
        { tools: toolsExecuted }
      );
    }

    // =====================================================
    // TOTAL VACAS
    // =====================================================

    if (
      hasWords(pregunta, ["cuantas", "vacas"]) ||
      hasWords(pregunta, ["cuantos", "bovinos"]) ||
      hasWords(pregunta, ["cuantas", "bovinos"]) ||
      pregunta.includes("total vacas") ||
      pregunta.includes("total bovinos")
    ) {
      const result = usuarioId
        ? await sql`
            SELECT COUNT(*) AS total
            FROM bovinos
            WHERE usuario_id = ${usuarioId}
          `
        : await sql`
            SELECT COUNT(*) AS total
            FROM bovinos
          `;

      return await finish(
        "sql",
        `Tienes ${result[0].total} bovinos registrados.`,
        { tools: toolsExecuted }
      );
    }

    // =====================================================
    // VACAS VACUNADAS
    // =====================================================

    if (
      pregunta.includes("vacunada") ||
      pregunta.includes("vacunadas") ||
      pregunta.includes("vacunado") ||
      pregunta.includes("vacunados")
    ) {
      const result = usuarioId
        ? await sql`
            SELECT DISTINCT
              v.nombre,
              v.numero_arete
            FROM bovinos v
            INNER JOIN vacuna_aplicada va
              ON va.bovino_id = v.id
            WHERE v.usuario_id = ${usuarioId}
          `
        : await sql`
            SELECT DISTINCT
              v.nombre,
              v.numero_arete
            FROM bovinos v
            INNER JOIN vacuna_aplicada va
              ON va.bovino_id = v.id
          `;

      if (!result.length) {
        return await finish("sql", "No hay vacas vacunadas.", {
          tools: toolsExecuted
        });
      }

      const texto = result
        .map((v: any) => `- ${v.nombre}\n(${v.numero_arete})`)
        .join("\n");

      return await finish("sql", `Vacas vacunadas:\n${texto}`, {
        tools: toolsExecuted
      });
    }

    // =====================================================
    // LISTAR VACAS
    // =====================================================

    if (
      pregunta.includes("que vacas tengo") ||
      pregunta.includes("que bovinos tengo") ||
      pregunta.includes("vacas registradas") ||
      pregunta.includes("bovinos registrados") ||
      pregunta.includes("listar vacas") ||
      pregunta.includes("listar bovinos") ||
      pregunta.includes("todas las vacas") ||
      pregunta.includes("todos los bovinos") ||
      pregunta.includes("total de vacas") ||
      pregunta.includes("total de bovinos") ||
      pregunta.includes("que vacas hay") ||
      pregunta.includes("que bovinos hay") ||
      pregunta.includes("listame las vacas ") ||
      pregunta.includes("listame los bovinos ")
    ) {
      const result = usuarioId
        ? await sql`
            SELECT
              nombre,
              raza,
              sexo,
              numero_arete
            FROM bovinos
            WHERE usuario_id = ${usuarioId}
          `
        : await sql`
            SELECT
              nombre,
              raza,
              sexo,
              numero_arete
            FROM bovinos
          `;

      if (!result.length) {
        return await finish("sql", "No hay bovinos registrados.", {
          tools: toolsExecuted
        });
      }

      const texto = result
        .map((v: any) => {
          return `
- ${v.nombre}
| ${v.raza}
| ${v.sexo}
| ${v.numero_arete}
`;
        })
        .join("\n");

      return await finish("sql", `Bovinos registrados:\n${texto}`, {
        tools: toolsExecuted
      });
    }

    // =====================================================
    // FUNCTION CALLING
    // =====================================================

    if (wantsStream) {
      sseWrite({ estado: "Consultando base de datos..." });
    }

    toolsExecuted.push({
      name: "ia.function-calling",
      status: "SUCCESS",
      params: {
        pregunta: preguntaParaAcciones,
        usuario_id: usuarioId,
        conversation_id: conversationId
      }
    });

    try {
      const functionResponse = await $fetch("/api/ia/function-calling", {
        method: "POST",
        body: {
          pregunta: preguntaParaAcciones,
          usuario_id: usuarioId,
          conversation_id: conversationId,
          historial,
          animal_context: animalMatch
            ? { id: animalMatch.id, nombre: animalMatch.nombre }
            : null
        }
      });

      toolsExecuted[toolsExecuted.length - 1].result = functionResponse;

      if (functionResponse?.encontrado) {
        return await finish("function-calling", functionResponse.respuesta, {
          tools: toolsExecuted
        });
      }
    } catch (error: any) {
      toolsExecuted[toolsExecuted.length - 1].status = "ERROR";
      toolsExecuted[toolsExecuted.length - 1].error = String(error?.message ?? error);
    }

    // =====================================================
    // SI EXISTE ANIMAL
    // =====================================================

    if (animalMatch) {
      const vacaId = animalMatch.id;

      const pesosRows = await sql`
        SELECT peso, fecha
        FROM pesos
        WHERE bovino_id = ${vacaId}
        ORDER BY fecha DESC
      `;

      const vacunasRows = await sql`
        SELECT
          vc.nombre AS vacuna_nombre,
          va.fecha_aplicacion,
          va.veterinario
        FROM vacuna_aplicada va
        LEFT JOIN vacunas vc
          ON vc.id = va.vacuna_id
        WHERE va.bovino_id = ${vacaId}
        ORDER BY va.fecha_aplicacion DESC
      `;

      const enfermedadesRows = await sql`
        SELECT
          nombre,
          tratamiento,
          fecha,
          veterinario
        FROM enfermedades
        WHERE bovino_id = ${vacaId}
        ORDER BY fecha DESC
      `;

      const historialRows = await sql`
        SELECT
          hp.fecha_inicio,
          hp.fecha_fin,
          d.nombre AS dueno_nombre,
          r.nombre AS rancho_nombre
        FROM historial_propiedad hp
        LEFT JOIN duenos d
          ON d.id = hp.dueno_id
        LEFT JOIN ranchos r
          ON r.id = hp.rancho_id
        WHERE hp.bovino_id = ${vacaId}
        ORDER BY hp.fecha_inicio DESC
      `;

      const ultimoPeso = pesosRows[0] ?? null;
      const propiedadActual = historialRows[0] ?? null;

      if (
        pregunta.includes("esta activa") ||
        pregunta.includes("sigue activa") ||
        pregunta.includes("esta dada de baja") ||
        pregunta.includes("esta de baja") ||
        pregunta.includes("ya se vendio") ||
        pregunta.includes("ya fue vendida") ||
        pregunta.includes("fue vendida") ||
        pregunta.includes("esta vendida") ||
        pregunta.includes("se vendio") ||
        pregunta.includes("vendida") ||
        pregunta.includes("vendido")
      ) {
        const ventaRows = await sql`
          SELECT *
          FROM ventas
          WHERE bovino_id = ${vacaId}
          ORDER BY fecha DESC
          LIMIT 1
        `;

        const venta = ventaRows[0] ?? null;

        if (venta) {
          return await finish(
            "sql",
            `
${animalMatch.nombre}
ya fue vendida.

Comprador:
${venta.comprador}

Precio:
$${venta.precio}

Fecha:
${venta.fecha}
`,
            { tools: toolsExecuted }
          );
        }

        const estado = animalMatch.estado ?? "activa";

        if (estado.toLowerCase() === "baja") {
          return await finish(
            "sql",
            `${animalMatch.nombre} está dada de baja.`,
            { tools: toolsExecuted }
          );
        }

        return await finish(
          "sql",
          `${animalMatch.nombre} sigue activa.`,
          { tools: toolsExecuted }
        );
      }

      if (pregunta.includes("edad") || pregunta.includes("años")) {
        const nacimiento = new Date(animalMatch.fecha_nacimiento);
        const hoy = new Date();
        const edad = hoy.getFullYear() - nacimiento.getFullYear();

        return await finish(
          "sql",
          `${animalMatch.nombre} tiene aproximadamente ${edad} años.`,
          { tools: toolsExecuted }
        );
      }

      if (pregunta.includes("peso") || pregunta.includes("pesa")) {
        if (!ultimoPeso) {
          return await finish(
            "sql",
            `No hay pesos registrados para ${animalMatch.nombre}.`,
            { tools: toolsExecuted }
          );
        }

        return await finish(
          "sql",
          `${animalMatch.nombre} pesa ${ultimoPeso.peso} kg.`,
          { tools: toolsExecuted }
        );
      }

      if (pregunta.includes("veterinario")) {
        if (vacunasRows.length) {
          const ultima = vacunasRows[0];

          return await finish(
            "sql",
            `El veterinario más reciente de ${animalMatch.nombre} fue ${ultima.veterinario}.`,
            { tools: toolsExecuted }
          );
        }

        if (enfermedadesRows.length) {
          const ultima = enfermedadesRows[0];

          return await finish(
            "sql",
            `El veterinario de ${animalMatch.nombre} fue ${ultima.veterinario}.`,
            { tools: toolsExecuted }
          );
        }

        return await finish(
          "sql",
          `No hay veterinarios registrados para ${animalMatch.nombre}.`,
          { tools: toolsExecuted }
        );
      }

      if (pregunta.includes("tratamiento")) {
        if (!enfermedadesRows.length) {
          return await finish(
            "sql",
            `${animalMatch.nombre} no tiene tratamientos registrados.`,
            { tools: toolsExecuted }
          );
        }

        const ultima = enfermedadesRows[0];

        return await finish(
          "sql",
          `El tratamiento de ${animalMatch.nombre} fue: ${ultima.tratamiento}.`,
          { tools: toolsExecuted }
        );
      }

      if (pregunta.includes("enfermedad") || pregunta.includes("enfermedades")) {
        if (!enfermedadesRows.length) {
          return await finish(
            "sql",
            `${animalMatch.nombre} no tiene enfermedades registradas.`,
            { tools: toolsExecuted }
          );
        }

        const texto = enfermedadesRows
          .map((e: any) => `- ${e.nombre}\n(${e.fecha})`)
          .join("\n");

        return await finish(
          "sql",
          `Enfermedades de ${animalMatch.nombre}:\n${texto}`,
          { tools: toolsExecuted }
        );
      }

      if (pregunta.includes("vacuna") || pregunta.includes("vacunas")) {
        if (!vacunasRows.length) {
          return await finish(
            "sql",
            `${animalMatch.nombre} no tiene vacunas registradas.`,
            { tools: toolsExecuted }
          );
        }

        const texto = vacunasRows
          .map(
            (v: any) => `
- ${v.vacuna_nombre}
(${v.fecha_aplicacion})
Veterinario:
${v.veterinario}
`
          )
          .join("\n");

        return await finish(
          "sql",
          `Vacunas de ${animalMatch.nombre}:\n${texto}`,
          { tools: toolsExecuted }
        );
      }

      if (pregunta.includes("historial")) {
        if (!historialRows.length) {
          return await finish(
            "sql",
            `${animalMatch.nombre} no tiene historial.`,
            { tools: toolsExecuted }
          );
        }

        const texto = historialRows
          .map(
            (h: any) => `
Dueño:
${h.dueno_nombre}

Rancho:
${h.rancho_nombre}

Desde:
${h.fecha_inicio}

Hasta:
${h.fecha_fin ?? "Actual"}
`
          )
          .join("\n");

        return await finish(
          "sql",
          `Historial de ${animalMatch.nombre}:\n${texto}`,
          { tools: toolsExecuted }
        );
      }

      const resumen = `
Nombre:
${animalMatch.nombre}

Arete:
${animalMatch.numero_arete}

Raza:
${animalMatch.raza}

Sexo:
${animalMatch.sexo}

Estado:
${animalMatch.estado ?? "activa"}

Dueño actual:
${propiedadActual?.dueno_nombre ?? "Sin dueño"}

Rancho actual:
${propiedadActual?.rancho_nombre ?? "Sin rancho"}

Último peso:
${ultimoPeso ? `${ultimoPeso.peso} kg` : "Sin peso"}

Vacunas registradas:
${vacunasRows.length}

Enfermedades registradas:
${enfermedadesRows.length}
`;

      return await finish("sql", resumen, { tools: toolsExecuted });
    }

    // =====================================================
    // FALLBACK RAG (STREAMING O NORMAL)
    // =====================================================

    sseWrite({ estado: "Pensando..." });

    const memoriaRows = usuarioId
      ? await sql`
          SELECT contenido
          FROM memories
          WHERE usuario_id = ${usuarioId}
          ORDER BY updated_at DESC, id DESC
          LIMIT 20
        `
      : [];

    const contextoMemorias = memoriaRows.length
      ? memoriaRows.map((m: any) => m.contenido).join("\n")
      : "";

    const contextoGanaderoRows = usuarioId
      ? await sql`
          SELECT contenido
          FROM semantic_contexts sc
          INNER JOIN bovinos v
            ON v.id = sc.bovino_id
          WHERE v.usuario_id = ${usuarioId}
          ORDER BY sc.updated_at DESC, sc.id DESC
          LIMIT 3
        `
      : await sql`
          SELECT contenido
          FROM semantic_contexts
          ORDER BY updated_at DESC, id DESC
          LIMIT 3
        `;

    const contextoGanadero = contextoGanaderoRows.length
      ? contextoGanaderoRows.map((r: any) => r.contenido).join("\n")
      : "";

    const ragMessages = buildRagMessages({
      preguntaOriginal,
      contextoMemorias,
      contextoGanadero,
      historial
    });

    const ollamaUnavailable =
      "No pude consultar el modelo de IA. Verifica que el contenedor ollamaganaderia esté en ejecución.";

    try {
      if (wantsStream) {
        let finalText = "";
        let firstTokenAt: number | null = null;

        const stream = await ollama.chat({
          model: "llama3.2:latest",
          stream: true,
          options: {
            temperature: 0,
            top_p: 0.1
          },
          messages: ragMessages
        });

        for await (const chunk of stream as any) {
          const token = chunk.message?.content ?? "";
          if (!token) continue;

          if (firstTokenAt === null) {
            firstTokenAt = Date.now();
            const ttftMs = firstTokenAt - requestStart;
            sseWrite({ estado: "Recibiendo respuesta..." });
            toolsExecuted.push({
              name: "ollama.chat",
              status: "SUCCESS",
              params: {
                model: "llama3.2:latest",
                stream: true
              },
              result: { ttft_ms: ttftMs }
            });
          }

          finalText += token;
          sseWrite({ token });
        }

        const ttftMs = firstTokenAt ? firstTokenAt - requestStart : null;

        return await finish("rag", finalText.trim() || "No encontré información relacionada en el sistema.", {
          ttftMs,
          alreadyStreamed: true,
          tools: toolsExecuted
        });
      }

      const response = await ollama.chat({
        model: "llama3.2:latest",
        stream: false,
        options: {
          temperature: 0,
          top_p: 0.1
        },
        messages: ragMessages
      });

      const respuestaFinal =
        response.message?.content?.trim() ||
        "No encontré información relacionada en el sistema.";

      toolsExecuted.push({
        name: "ollama.chat",
        status: "SUCCESS",
        params: {
          model: "llama3.2:latest",
          stream: false
        },
        result: {
          response: respuestaFinal
        }
      });

      return await finish("rag", respuestaFinal, {
        ttftMs: null,
        tools: toolsExecuted
      });
    } catch (ollamaError: any) {
      toolsExecuted.push({
        name: "ollama.chat",
        status: "ERROR",
        error: String(ollamaError?.message ?? ollamaError)
      });

      return await finish("rag", ollamaUnavailable, {
        tools: toolsExecuted
      });
    }
  } catch (error: any) {
    const errorText = `Error interno en el router: ${String(
      error?.message ?? error
    )}`;

    try {
      await logAi({
        responseText: errorText,
        ttftMs: null,
        wasBlocked: false,
        toolsExecuted: [
          ...toolsExecuted,
          {
            name: "router.error",
            status: "ERROR",
            error: String(error?.message ?? error)
          }
        ]
      });
    } catch {
      // no-op
    }

    if (conversationId) {
      try {
        await insertConversationMessage("assistant", errorText);
      } catch {
        // no-op
      }
    }

    if (wantsStream) {
      sseWrite({ estado: "Error consultando IA." });
      sseWrite({ token: "Error consultando IA." });
      sseWrite("done", "end");
      event.node.res.end();
      return;
    }

    return {
      tipo: "error",
      respuesta: "Error consultando IA."
    };
  }
});