import { sql } from "~/lib/db";
import { ollama } from "~/lib/ollama";
import { normalizeIaAnswer } from "~/lib/iaResponse";
import { setResponseHeader } from "h3";
import {
  detectPromptInjection,
  GUARDRAIL_BLOCKED_MESSAGE
} from "~/server/lib/guardrails";
import {
  extraerConsultaEspecificaBovino
} from "~/lib/bovinoRouterHelpers";
import {
  buildClarificationList,
  extractCountTarget,
  greetingResponse,
  isCountQuery,
  isExplicitMemoryWrite,
  isGreeting,
  isIncompleteAction,
  isVentaListQuery,
  isWriteActionIntent
} from "~/lib/iaIntentRouter";
import {
  enrichQuestionWithAnimal,
  isContextualFollowUp,
  resolveAnimalFromContext
} from "~/lib/conversationContext";
import { planIaTurn } from "~/lib/iaActionPlanner.js";
import { memoryConfirmation, memoryToUserPerspective } from "~/lib/iaMemoryPerspective.js";
import {
  clearPendingIaAction,
  getIaConversationContext,
  getPendingIaAction,
  setIaConversationBovino,
  setPendingIaAction
} from "~/lib/iaConversationState.js";
import { apiError } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
import {
  routeIaMessage,
  type AgentRoute
} from "~/server/ai/agents/routerAgent";
import {
  buildAgentContext,
  type AgentContext
} from "~/server/ai/context/agentContext";
import { runTransactionalAgent } from "~/server/ai/agents/transactionalAgent";
import { runRagAgent } from "~/server/ai/agents/ragAgent";
import type { RagMetrics } from "~/server/ai/rag/advancedRagPipeline";

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

let observabilitySchemaReady: Promise<void> | null = null;

function ensureObservabilitySchema() {
  if (!observabilitySchemaReady) {
    observabilitySchemaReady = sql`
      ALTER TABLE ai_logs
        ADD COLUMN IF NOT EXISTS selected_agent VARCHAR(32),
        ADD COLUMN IF NOT EXISTS intent VARCHAR(100),
        ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,4),
        ADD COLUMN IF NOT EXISTS route_reason TEXT,
        ADD COLUMN IF NOT EXISTS context_sources TEXT,
        ADD COLUMN IF NOT EXISTS retrieved_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS reranked_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS reranker_used INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS retrieval_latency_ms INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS rerank_latency_ms INTEGER DEFAULT 0
    `.then(() => undefined).catch((error) => {
      observabilitySchemaReady = null;
      throw error;
    });
  }

  return observabilitySchemaReady;
}

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
      respuesta: memoryConfirmation(cleaned)
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
      respuesta: memoryConfirmation(contenido)
    };
  }

  if (/^mi rancho favorito es\s+/.test(cleanedNormalized)) {
    return {
      slot: "rancho_favorito",
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: memoryConfirmation(cleaned)
    };
  }

  if (/^mi proveedor favorito es\s+/.test(cleanedNormalized)) {
    return {
      slot: "proveedor_favorito",
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: memoryConfirmation(cleaned)
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
      respuesta: memoryConfirmation(cleaned)
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
      respuesta: memoryConfirmation(cleaned)
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
      respuesta: memoryConfirmation(cleaned)
    };
  }

  if (/^(me gusta|me gustan|amo|adoro)\s+/.test(cleanedNormalized)) {
    return {
      slot: "me_gusta",
      tipo: "gusto",
      contenido: cleaned,
      respuesta: memoryConfirmation(cleaned)
    };
  }

  if (/^(no me gusta|odio|detesto)\s+/.test(cleanedNormalized)) {
    return {
      slot: "no_me_gusta",
      tipo: "disgusto",
      contenido: cleaned,
      respuesta: memoryConfirmation(cleaned)
    };
  }

  if (/^prefiero\s+/.test(cleanedNormalized)) {
    return {
      slot: "preferencia",
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: memoryConfirmation(cleaned)
    };
  }

  if (/^(soy|me llamo)\s+/.test(cleanedNormalized)) {
    return {
      slot: "identidad",
      tipo: "identidad",
      contenido: cleaned,
      respuesta: memoryConfirmation(cleaned)
    };
  }

  if (/^vivo en\s+/.test(cleanedNormalized)) {
    return {
      slot: "vivo_en",
      tipo: "ubicacion",
      contenido: cleaned,
      respuesta: memoryConfirmation(cleaned)
    };
  }

  if (/^trabajo en\s+/.test(cleanedNormalized)) {
    return {
      slot: "trabajo_en",
      tipo: "ocupacion",
      contenido: cleaned,
      respuesta: memoryConfirmation(cleaned)
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
      respuesta: memoryConfirmation(cleaned)
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
      respuesta: memoryConfirmation(cleaned)
    };
  }

  if (
    normalized.startsWith("recuerda que ") ||
    normalized.startsWith("recuerda ") ||
    normalized.startsWith("mi ") ||
    normalized.startsWith("me gusta ") ||
    normalized.startsWith("me gustan ") ||
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
      respuesta: memoryConfirmation(cleaned)
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
  return isWriteActionIntent(text);
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
• Registrar, actualizar y eliminar bovinos (vacas hembras o toros machos)
• Agregar, actualizar y eliminar vacunas del catálogo
• Aplicar o quitar vacunas de un bovino
• Registrar, actualizar y eliminar enfermedades
• Crear, actualizar y eliminar ranchos
• Asignar automáticamente tu cuenta como propietaria al registrar bovinos
• Registrar pesos
• Enviar bovinos a otros usuarios mediante solicitudes seguras
• Aceptar, rechazar, cancelar y consultar transferencias
• Consultar y crear razas del catalogo global
• Enviar solicitudes de contacto y mensajes privados
• Consultar conversaciones comunitarias

Ejemplos:

- ¿Cuántos bovinos tengo?
- ¿Cuántos ranchos tengo?
- ¿Qué vacunas tiene Lola?
- ¿Qué vaca está lista para venta?
- Registra un bovino: lulu, MC323, macho, Bramming
- Crea un rancho llamado Sur Maru
- Transfiere la vaca Lola al usuario mario@gmail.com
- Aplica la vacuna Antiaftosa a Lola
- Elimina una vaca (te pediré cuál si no especificas)
- Recuerda que mi vaca favorita es Lola

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

  const usuarioId = requireUserId(event);

  if (conversationId) {
    const owner = await sql`
      SELECT id FROM conversations
      WHERE id = ${conversationId} AND usuario_id = ${usuarioId}
      LIMIT 1
    `;
    if (!owner.length) {
      apiError({ statusCode: 404, code: "NOT_FOUND", message: "Conversacion no encontrada." });
    }
  }

  const preguntaOriginal = body.pregunta ?? "";
  const pregunta = normalizeText(preguntaOriginal);
  const wantsStream = Boolean(body.stream);
  const sessionId = conversationId ?? `user:${usuarioId ?? "anonymous"}`;
  const toolsExecuted: ToolExecution[] = [];
  let routerStage = "initialize";
  let selectedRoute: AgentRoute = {
    agent: "direct",
    intent: "initialize",
    confidence: 0,
    reason: "Ruta pendiente de clasificacion."
  };
  let agentContext: AgentContext = { recentMessages: [] };
  let ragMetrics: RagMetrics | null = null;
  let contextSources: string[] = [];
  let assistantMessagePersisted = false;

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

  selectedRoute = routeIaMessage(preguntaOriginal, historial);
  agentContext = buildAgentContext({
    conversationId,
    recentMessages: historial,
    currentMessage: preguntaOriginal,
    conversationState: getIaConversationContext(conversationId, usuarioId)
  });

  async function insertConversationMessage(role: "user" | "assistant", content: string) {
    if (!conversationId) return null;

    const rows = await sql`
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
      RETURNING id
    `;
    return Number(rows[0]?.id ?? 0) || null;
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

    await ensureObservabilitySchema();

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
        tools_executed,
        selected_agent,
        intent,
        confidence,
        route_reason,
        context_sources,
        retrieved_count,
        reranked_count,
        reranker_used,
        retrieval_latency_ms,
        rerank_latency_ms
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
        ${JSON.stringify(params.toolsExecuted)},
        ${selectedRoute.agent},
        ${selectedRoute.intent},
        ${selectedRoute.confidence},
        ${selectedRoute.reason},
        ${JSON.stringify(contextSources)},
        ${ragMetrics?.retrievedCount ?? 0},
        ${ragMetrics?.rerankedCount ?? 0},
        ${ragMetrics?.rerankerUsed ? 1 : 0},
        ${ragMetrics?.retrievalLatencyMs ?? 0},
        ${ragMetrics?.rerankLatencyMs ?? 0}
      )
    `;
  }

  function sseWrite(payload: unknown, eventName = "message") {
    if (!wantsStream) return;

    if (eventName === "end") {
      event.node.res.write(`event: end\ndata: done\n\n`);
      return;
    }

    const eventHeader = eventName === "message" ? "" : `event: ${eventName}\n`;
    event.node.res.write(`${eventHeader}data: ${JSON.stringify(payload)}\n\n`);
  }

  async function streamTextAndFinish(
    tipo: string,
    texto: unknown,
    meta?: {
      wasBlocked?: boolean;
      ttftMs: number | null;
      tools?: ToolExecution[];
      alreadyStreamed?: boolean;
    }
  ) {
    const answer = normalizeIaAnswer(texto);
    let messageId: number | null = null;

    if (conversationId) {
      try {
        messageId = await insertConversationMessage("assistant", answer);
        assistantMessagePersisted = true;
      } catch (error) {
        console.error("No se pudo guardar la respuesta de IA:", error);
      }
    }

    try {
      await logAi({
        responseText: answer,
        ttftMs: meta?.ttftMs ?? null,
        wasBlocked: meta?.wasBlocked ?? false,
        toolsExecuted: meta?.tools ?? toolsExecuted
      });
    } catch (error) {
      console.error("No se pudo registrar la observabilidad de IA:", error);
    }

    if (wantsStream) {
      if (!meta?.alreadyStreamed) {
        for (const part of tokenizeForStreaming(answer)) {
          sseWrite({ token: part });
        }
      }

      sseWrite({
        tipo,
        answer,
        respuesta: answer,
        final: true,
        message_id: messageId
      }, "answer");
      sseWrite({ estado: "" });
      sseWrite("done", "end");
      event.node.res.end();
      return;
    }

    return {
      tipo,
      answer,
      respuesta: answer
    };
  }

  async function finish(
    tipo: string,
    texto: unknown,
    meta?: {
      wasBlocked?: boolean;
      ttftMs?: number | null;
      tools?: ToolExecution[];
      alreadyStreamed?: boolean;
    }
  ) {
    return await streamTextAndFinish(tipo, texto, meta);
  }

  async function runPlannerQuery(query: any) {
    toolsExecuted.push({
      name: "ia.planner.query",
      status: "SUCCESS",
      params: query
    });

    if (query.type === "tool") {
      return executePlannerAction(query.tool, query.args ?? {});
    }

    if (query.type === "count") {
      const target = query.target;
      let rows: any[];

      if (target === "vacas") {
        rows = await sql`
          SELECT COUNT(*) AS total
          FROM bovinos
          WHERE usuario_id = ${usuarioId}
            AND LOWER(sexo) = 'hembra'
        `;
        return await finish("sql", `Tienes ${rows[0].total} vacas registradas.`, {
          tools: toolsExecuted
        });
      }

      if (target === "toros") {
        rows = await sql`
          SELECT COUNT(*) AS total
          FROM bovinos
          WHERE usuario_id = ${usuarioId}
            AND LOWER(sexo) = 'macho'
        `;
        return await finish("sql", `Tienes ${rows[0].total} toros registrados.`, {
          tools: toolsExecuted
        });
      }

      const tableByTarget: Record<string, string> = {
        bovinos: "bovinos",
        ranchos: "ranchos",
        duenos: "duenos",
        vacunas_catalogo: "vacunas"
      };

      const table = tableByTarget[target] ?? "bovinos";
      rows = await sql.unsafe(
        `SELECT COUNT(*) AS total FROM ${table} WHERE usuario_id = $1`,
        [usuarioId]
      );

      const labels: Record<string, string> = {
        bovinos: "bovinos registrados",
        ranchos: "ranchos registrados",
        duenos: "duenos registrados",
        vacunas_catalogo: "vacunas en tu catalogo"
      };

      return await finish("sql", `Tienes ${rows[0].total} ${labels[target] ?? "registros"}.`, {
        tools: toolsExecuted
      });
    }

    if (query.type === "list") {
      if (query.target === "vacunas_catalogo") {
        const rows = await sql`
          SELECT nombre, descripcion
          FROM vacunas
          WHERE usuario_id = ${usuarioId}
          ORDER BY nombre ASC
        `;

        if (!rows.length) {
          return await finish("sql", "Actualmente no tienes vacunas registradas en el catalogo.", {
            tools: toolsExecuted
          });
        }

        const texto = rows.map((v: any) => `- ${v.nombre}`).join("\n");
        return await finish("sql", `Vacunas en tu catalogo:\n${texto}`, {
          tools: toolsExecuted
        });
      }

      if (query.target === "bovinos") {
        const rows = await sql`
          SELECT nombre, numero_arete, raza, sexo, estado
          FROM bovinos
          WHERE usuario_id = ${usuarioId}
          ORDER BY nombre ASC
        `;

        if (!rows.length) {
          return await finish("sql", "No tienes bovinos registrados.", {
            tools: toolsExecuted
          });
        }

        const texto = rows
          .map((v: any) => `- ${v.nombre} (${v.numero_arete}) | ${v.sexo} | ${v.raza}`)
          .join("\n");
        return await finish("sql", `Bovinos registrados:\n${texto}`, {
          tools: toolsExecuted
        });
      }

      if (query.target === "ranchos") {
        const rows = await sql`
          SELECT nombre, ubicacion
          FROM ranchos
          WHERE usuario_id = ${usuarioId}
          ORDER BY nombre ASC
        `;

        if (!rows.length) {
          return await finish("sql", "No tienes ranchos registrados.", {
            tools: toolsExecuted
          });
        }

        return await finish("sql", `Ranchos registrados:\n${rows.map((r: any) => `- ${r.nombre}`).join("\n")}`, {
          tools: toolsExecuted
        });
      }

      if (query.target === "duenos") {
        const rows = await sql`
          SELECT nombre, telefono
          FROM duenos
          WHERE usuario_id = ${usuarioId}
          ORDER BY nombre ASC
        `;

        if (!rows.length) {
          return await finish("sql", "No tienes duenos registrados.", {
            tools: toolsExecuted
          });
        }

        return await finish("sql", `Duenos registrados:\n${rows.map((d: any) => `- ${d.nombre}`).join("\n")}`, {
          tools: toolsExecuted
        });
      }

      if (query.target === "venta_listos") {
        const bovinosVenta = await sql`
          SELECT nombre FROM bovinos
          WHERE usuario_id = ${usuarioId}
            AND LOWER(COALESCE(estado, 'activa')) NOT IN ('vendida', 'vendido', 'baja')
          ORDER BY nombre
        `;
        const aptos: string[] = [];
        for (const bovino of bovinosVenta) {
          const evaluacion: any = await event.$fetch("/api/ia/venta", {
            method: "POST",
            body: { nombre: bovino.nombre }
          });
          if (evaluacion.lista) aptos.push(String(bovino.nombre));
        }
        return await finish(
          "sql",
          aptos.length
            ? `Bovinos listos para venta:\n${aptos.map((nombre) => `- ${nombre}`).join("\n")}`
            : "No tienes bovinos que cumplan actualmente con el peso minimo y todas las vacunas obligatorias.",
          { tools: toolsExecuted }
        );
      }
    }

    if (query.type === "readiness" && query.target === "venta_estado") {
      const nombre = String(query.args?.nombre ?? "").trim();
      if (!nombre) {
        return await finish("sql", "¿De que bovino deseas verificar la venta?", { tools: toolsExecuted });
      }

      const rows = await sql`
        SELECT id, nombre, numero_arete FROM bovinos
        WHERE usuario_id = ${usuarioId} AND LOWER(nombre) = LOWER(${nombre})
        LIMIT 1
      `;
      if (!rows.length) {
        return await finish("sql", `No encontre el bovino "${nombre}" en tu cuenta.`, { tools: toolsExecuted });
      }

      const bovino = rows[0];
      setIaConversationBovino(conversationId, usuarioId, bovino, "verificar_venta");
      const evaluacion: any = await event.$fetch("/api/ia/venta", {
        method: "POST",
        body: { nombre: bovino.nombre }
      });
      return await finish("sql", evaluacion.respuesta, { tools: toolsExecuted });
    }

    if (query.type === "search" && query.target === "bovino_arete") {
      if (!query.args?.numero_arete) {
        return await finish("sql", "Indica el numero de arete que deseas buscar.", {
          tools: toolsExecuted
        });
      }

      const rows = await sql`
        SELECT nombre, numero_arete, raza, sexo, estado
        FROM bovinos
        WHERE usuario_id = ${usuarioId}
          AND LOWER(numero_arete) = LOWER(${query.args.numero_arete})
        LIMIT 5
      `;

      if (!rows.length) {
        return await finish("sql", `No encontre bovinos con arete ${query.args.numero_arete}.`, {
          tools: toolsExecuted
        });
      }

      const texto = rows
        .map((v: any) => `- ${v.nombre} (${v.numero_arete}) | ${v.sexo} | ${v.raza} | ${v.estado ?? "activa"}`)
        .join("\n");
      return await finish("sql", `Resultado de busqueda:\n${texto}`, {
        tools: toolsExecuted
      });
    }

    return null;
  }

  async function executePlannerAction(tool: string, args: Record<string, unknown>) {
    toolsExecuted.push({
      name: "ia.planner.action",
      status: "SUCCESS",
      params: {
        tool,
        args
      }
    });

    try {
      const response: any = await runTransactionalAgent({
        event,
        message: preguntaOriginal,
        usuarioId,
        conversationId,
        context: agentContext,
        directTool: tool,
        directArgs: args
      });

      toolsExecuted[toolsExecuted.length - 1].result = response;
      const toolResult = response?.resultado;
      if (toolResult?.ok === false) {
        toolsExecuted[toolsExecuted.length - 1].status = "ERROR";
        toolsExecuted[toolsExecuted.length - 1].error = String(
          toolResult.error ?? toolResult.reason ?? "La herramienta rechazo la solicitud."
        );
      }
      if (tool === "crearBovino" && toolResult?.requiresBreedCreation) {
        setPendingIaAction(conversationId, usuarioId, {
          tool: "crearRazaYBovino",
          args,
          missing: [],
          awaitingConfirmation: true
        });
        return await finish(
          "planner",
          `La raza "${toolResult.requestedBreed}" no existe registrada. Deseas crearla y despues registrar el bovino?`,
          { tools: toolsExecuted }
        );
      }
      if (
        ["crearSolicitudTransferencia", "enviarSolicitudAmistad"].includes(tool) &&
        toolResult?.requiresDestinationSelection
      ) {
        setPendingIaAction(conversationId, usuarioId, {
          tool,
          args: { ...args, usuario_destino: "" },
          missing: ["usuario_destino"],
          awaitingConfirmation: false
        });
        return await finish("planner", response.respuesta, { tools: toolsExecuted });
      }
      const resultBovino = response?.resultado?.bovino;
      if (resultBovino?.id && resultBovino?.nombre) {
        setIaConversationBovino(conversationId, usuarioId, resultBovino, tool);
      }
      return await finish("function-calling", normalizeIaAnswer(
        response,
        `La herramienta ${tool} termino sin devolver una respuesta.`
      ), {
        tools: toolsExecuted
      });
    } catch (error: any) {
      const errorCode = String(
        error?.data?.data?.code ?? error?.data?.code ?? error?.code ?? "TOOL_EXECUTION_ERROR"
      );
      const errorMessage = String(
        error?.data?.data?.message ??
        error?.data?.message ??
        error?.statusMessage ??
        error?.message ??
        `La herramienta ${tool} fallo sin devolver un detalle de validacion.`
      );
      toolsExecuted[toolsExecuted.length - 1].status = "ERROR";
      toolsExecuted[toolsExecuted.length - 1].error = errorMessage;
      toolsExecuted[toolsExecuted.length - 1].result = {
        code: errorCode,
        message: errorMessage,
        tool,
        args
      };
      console.error("Error ejecutando accion planificada:", {
        tool,
        args,
        code: errorCode,
        message: errorMessage,
        technical_message: String(error?.message ?? error)
      });

      return await finish(
        "function-calling",
        errorMessage,
        { tools: toolsExecuted }
      );
    }
  }

  try {
    routerStage = "save-user-message";
    if (conversationId) {
      await insertConversationMessage("user", preguntaOriginal);
    }

    // =====================================================
    // GUARDRAILS
    // =====================================================

    if (detectPromptInjection(preguntaOriginal)) {
      selectedRoute = {
        agent: "direct",
        intent: "security_block",
        confidence: 1,
        reason: "El guardrail detecto una instruccion potencialmente peligrosa."
      };
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
    // SALUDOS
    // =====================================================

    if (isGreeting(preguntaOriginal)) {
      return await finish("saludo", greetingResponse(preguntaOriginal), {
        tools: toolsExecuted
      });
    }

    // =====================================================
    // MEMORIA ESCRITA
    // =====================================================

    const memoryWrite = isExplicitMemoryWrite(preguntaOriginal)
      ? detectMemoryWrite(preguntaOriginal)
      : null;

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
        const created = await event.$fetch("/api/memories/create", {
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
    // PLANIFICADOR DETERMINISTA DE IA
    // Maneja consultas simples, datos faltantes, acciones
    // pendientes y confirmaciones antes de usar el LLM.
    // =====================================================

    routerStage = "read-conversation-state";
    const pendingAction = getPendingIaAction(conversationId, usuarioId);
    const conversationContext = getIaConversationContext(conversationId, usuarioId);
    routerStage = "plan-turn";
    const plannedTurn = planIaTurn({
      text: preguntaOriginal,
      pending: pendingAction,
      context: conversationContext
    });

    routerStage = "log-planned-turn";
    toolsExecuted.push({
      name: "ia.intent.planner",
      status: "SUCCESS",
      params: {
        pregunta: preguntaOriginal,
        pending: pendingAction,
        planned: plannedTurn
      }
    });

    if (
      plannedTurn.clearPending &&
      plannedTurn.kind !== "execute" &&
      plannedTurn.kind !== "clear"
    ) {
      clearPendingIaAction(conversationId, usuarioId);
      toolsExecuted.push({
        name: "ia.pending.cancelled_on_topic_change",
        status: "SUCCESS",
        params: {
          previous_tool: plannedTurn.cancelledPending ?? pendingAction?.tool ?? null,
          current_kind: plannedTurn.kind
        }
      });
    }

    if (plannedTurn.kind === "clear") {
      selectedRoute = {
        agent: "transactional",
        intent: "transaction_cancelled",
        confidence: 1,
        reason: "El planner cancelo una accion transaccional pendiente."
      };
      clearPendingIaAction(conversationId, usuarioId);
      return await finish("planner", plannedTurn.respuesta, {
        tools: toolsExecuted
      });
    }

    if (plannedTurn.kind === "clarify" || plannedTurn.kind === "empty") {
      return await finish("planner", plannedTurn.respuesta, {
        tools: toolsExecuted
      });
    }

    if (plannedTurn.kind === "pending") {
      selectedRoute = {
        agent: "transactional",
        intent: "transaction_pending",
        confidence: 1,
        reason: "El planner requiere datos o confirmacion antes de ejecutar una tool."
      };
      routerStage = "save-pending-action";
      setPendingIaAction(conversationId, usuarioId, plannedTurn.pending);
      routerStage = "respond-pending-action";
      return await finish("planner", plannedTurn.respuesta, {
        tools: toolsExecuted
      });
    }

    if (plannedTurn.kind === "execute") {
      selectedRoute = {
        agent: "transactional",
        intent: "transaction_execute",
        confidence: 1,
        reason: "El planner valido la confirmacion y delego la operacion al agente transaccional."
      };
      if (plannedTurn.clearPending) {
        clearPendingIaAction(conversationId, usuarioId);
      }

      return await executePlannerAction(
        plannedTurn.tool,
        plannedTurn.args
      );
    }

    if (plannedTurn.kind === "query") {
      selectedRoute = {
        agent: "transactional",
        intent: "database_query",
        confidence: 1,
        reason: "El planner resolvio una consulta concreta sobre PostgreSQL."
      };
      return await runPlannerQuery(plannedTurn.query);
    }

    // =====================================================
    // CARGAR BOVINOS DEL USUARIO
    // =====================================================

    const bovinos = await sql`
      SELECT * FROM bovinos WHERE usuario_id = ${usuarioId}
    `;

    const animalMatch = resolveAnimalFromContext(
      pregunta,
      bovinos,
      historial
    );

    if (animalMatch?.id && animalMatch?.nombre) {
      setIaConversationBovino(conversationId, usuarioId, animalMatch, "consulta");
    }

    const preguntaParaAcciones = enrichQuestionWithAnimal(
      preguntaOriginal,
      animalMatch
    );

    const accionIncompleta = isIncompleteAction(preguntaOriginal);
    if (accionIncompleta === "delete" && bovinos.length) {
      return await finish(
        "clarificacion",
        buildClarificationList(
          "delete",
          bovinos.map((v: any) => ({
            nombre: v.nombre,
            numero_arete: v.numero_arete,
            extra: v.sexo
          }))
        ),
        { tools: toolsExecuted }
      );
    }

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
        const functionResponse: any = await runTransactionalAgent({
          event,
          message: preguntaParaAcciones,
          usuarioId,
          conversationId,
          context: {
            ...agentContext,
            ...(animalMatch
              ? {
                  lastBovino: {
                    id: animalMatch.id,
                    nombre: animalMatch.nombre,
                    numero_arete: animalMatch.numero_arete
                  }
                }
              : {})
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
          "El agente transaccional termino sin devolver el resultado de la herramienta.",
          { tools: toolsExecuted }
        );
      } catch (error: any) {
        toolsExecuted[toolsExecuted.length - 1].status = "ERROR";
        toolsExecuted[toolsExecuted.length - 1].error = String(error?.message ?? error);

        return await finish(
          "function-calling",
          String(
            error?.data?.data?.message ??
            error?.data?.message ??
            error?.statusMessage ??
            `La herramienta fallo durante ${routerStage}. El detalle tecnico quedo registrado.`
          ),
          { tools: toolsExecuted }
        );
      }
    }

    const consultaEspecifica = extraerConsultaEspecificaBovino(preguntaOriginal);

    if (consultaEspecifica && !animalMatch && !isVentaListQuery(preguntaOriginal)) {
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
            respuestaMemoria = memoryToUserPerspective(exact.contenido);
          }
        }
      }

      if (!respuestaMemoria && relacionadas.length) {
        respuestaMemoria =
          "Esto encuentro relacionado:\n\n" +
          relacionadas
            .map((m: any) => `• ${memoryToUserPerspective(m.contenido)}`)
            .join("\n");
      }

      if (!respuestaMemoria) {
        if (!memoriesUsuario.length) {
          respuestaMemoria = "No tengo recuerdos almacenados sobre ti.";
        } else {
          respuestaMemoria =
            "Recuerdo lo siguiente:\n\n" +
            memoriesUsuario
              .map((m: any) => `• ${memoryToUserPerspective(m.contenido)}`)
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
    // CONTEOS GENERALES
    // =====================================================

    if (isCountQuery(preguntaOriginal)) {
      const target = extractCountTarget(preguntaOriginal);

      if (target === "ranchos") {
        const result = await sql`SELECT COUNT(*) AS total FROM ranchos WHERE usuario_id = ${usuarioId}`;
        return await finish("sql", `Tienes ${result[0].total} ranchos registrados.`, {
          tools: toolsExecuted
        });
      }

      if (target === "duenos") {
        const result = await sql`SELECT COUNT(*) AS total FROM duenos WHERE usuario_id = ${usuarioId}`;
        return await finish("sql", `Tienes ${result[0].total} dueños registrados.`, {
          tools: toolsExecuted
        });
      }

      if (target === "vacunas_catalogo") {
        const result = await sql`SELECT COUNT(*) AS total FROM vacunas WHERE usuario_id = ${usuarioId}`;
        return await finish("sql", `Tienes ${result[0].total} vacunas en el catálogo.`, {
          tools: toolsExecuted
        });
      }

      if (target === "enfermedades") {
        const result = await sql`
              SELECT COUNT(*) AS total
              FROM enfermedades e
              INNER JOIN bovinos b ON b.id = e.bovino_id
              WHERE b.usuario_id = ${usuarioId}
            `;
        return await finish("sql", `Hay ${result[0].total} enfermedades registradas.`, {
          tools: toolsExecuted
        });
      }
    }

    // =====================================================
    // LISTA PARA VENTA (consulta general)
    // =====================================================

    if (isVentaListQuery(preguntaOriginal)) {
      const candidatos = await sql`
            SELECT id, nombre, numero_arete
            FROM bovinos
            WHERE usuario_id = ${usuarioId}
              AND LOWER(COALESCE(estado, 'activa')) NOT IN ('vendida', 'vendido', 'baja')
          `;

      const aptas: string[] = [];

      for (const vaca of candidatos) {
        const ventaResponse = await event.$fetch<{ respuesta?: string; lista?: boolean }>(
          "/api/ia/venta",
          {
            method: "POST",
            body: { nombre: vaca.nombre }
          }
        );

        if (ventaResponse?.lista) {
          aptas.push(`- ${vaca.nombre} (${vaca.numero_arete})`);
        }
      }

      if (!aptas.length) {
        return await finish(
          "sql",
          "Ningún bovino cumple actualmente los requisitos para venta.",
          { tools: toolsExecuted }
        );
      }

      return await finish(
        "sql",
        `Bovinos listos para venta:\n${aptas.join("\n")}`,
        { tools: toolsExecuted }
      );
    }

    // =====================================================
    // LISTA PARA VENTA (bovino específico)
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

      const ventaResponse = await event.$fetch("/api/ia/venta", {
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
      (hasWords(pregunta, ["cuantas", "hembras"]) ||
        hasWords(pregunta, ["cuantas", "hembra"]) ||
        hasWords(pregunta, ["cuantos", "hembras"]) ||
        hasWords(pregunta, ["cuantos", "hembra"])) &&
      !hasWords(pregunta, ["machos"]) &&
      !hasWords(pregunta, ["macho"])
    ) {
      const result = await sql`
            SELECT COUNT(*) AS total
            FROM bovinos
            WHERE LOWER(sexo) = 'hembra'
              AND usuario_id = ${usuarioId}
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
      (hasWords(pregunta, ["cuantos", "machos"]) ||
        hasWords(pregunta, ["cuantos", "macho"]) ||
        hasWords(pregunta, ["cuantas", "machos"]) ||
        hasWords(pregunta, ["cuantas", "macho"])) &&
      !hasWords(pregunta, ["hembras"]) &&
      !hasWords(pregunta, ["hembra"])
    ) {
      const result = await sql`
            SELECT COUNT(*) AS total
            FROM bovinos
            WHERE LOWER(sexo) = 'macho'
              AND usuario_id = ${usuarioId}
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
      const result = await sql`
            SELECT COUNT(*) AS total
            FROM bovinos
            WHERE usuario_id = ${usuarioId}
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
      const result = await sql`
            SELECT DISTINCT
              v.nombre,
              v.numero_arete
            FROM bovinos v
            INNER JOIN vacuna_aplicada va
              ON va.bovino_id = v.id
            WHERE v.usuario_id = ${usuarioId}
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
      const result = await sql`
            SELECT
              nombre,
              raza,
              sexo,
              numero_arete
            FROM bovinos
            WHERE usuario_id = ${usuarioId}
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
      const functionResponse: any = await runTransactionalAgent({
        event,
        message: preguntaParaAcciones,
        usuarioId,
        conversationId,
        context: {
          ...agentContext,
          ...(animalMatch
            ? {
                lastBovino: {
                  id: animalMatch.id,
                  nombre: animalMatch.nombre,
                  numero_arete: animalMatch.numero_arete
                }
              }
            : {})
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

    try {
      const ragResult = await runRagAgent({
        query: preguntaOriginal,
        usuarioId,
        context: agentContext,
        stream: wantsStream,
        onToken: wantsStream ? (token) => sseWrite({ token }) : undefined
      });

      ragMetrics = ragResult.metrics;
      contextSources = [...new Set(
        ragResult.retrievedContext.map((item) => item.source)
      )];

      toolsExecuted.push({
        name: "rag.hybrid_search",
        status: "SUCCESS",
        params: { top_k: 10 },
        result: {
          retrieved_count: ragMetrics.retrievedCount,
          retrieval_latency_ms: ragMetrics.retrievalLatencyMs,
          sources: contextSources
        }
      });
      toolsExecuted.push({
        name: "rag.reranker",
        status: ragMetrics.rerankerUsed ? "SUCCESS" : "ERROR",
        params: { top_k: 3 },
        result: {
          reranker_used: ragMetrics.rerankerUsed,
          reranked_count: ragMetrics.rerankedCount,
          rerank_latency_ms: ragMetrics.rerankLatencyMs,
          fallback: ragMetrics.rerankerFallback ?? null
        }
      });
      toolsExecuted.push({
        name: "ollama.chat",
        status: "SUCCESS",
        params: {
          model: process.env.CHAT_MODEL ?? "llama3.2:latest",
          stream: wantsStream,
          agent: "rag"
        }
      });

      return await finish("rag", ragResult.answer, {
        ttftMs: ragResult.metrics.ttftMs || null,
        alreadyStreamed: wantsStream,
        tools: toolsExecuted
      });
    } catch (advancedRagError: any) {
      toolsExecuted.push({
        name: "rag.advanced_pipeline",
        status: "ERROR",
        error: String(advancedRagError?.message ?? advancedRagError)
      });
    }

    sseWrite({ estado: "Pensando..." });

    const memoriaRows = await sql`
          SELECT contenido
          FROM memories
          WHERE usuario_id = ${usuarioId}
          ORDER BY updated_at DESC, id DESC
          LIMIT 20
        `;

    const contextoMemorias = memoriaRows.length
      ? memoriaRows.map((m: any) => m.contenido).join("\n")
      : "";

    const contextoGanaderoRows = await sql`
          SELECT contenido
          FROM semantic_contexts sc
          INNER JOIN bovinos v
            ON v.id = sc.bovino_id
          WHERE v.usuario_id = ${usuarioId}
          ORDER BY sc.updated_at DESC, sc.id DESC
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
    console.error("IA router error", error);
    const errorText = `Error interno en el router [${routerStage}]: ${String(
      error?.message ?? error
    )}`;
    const knownError = error?.data?.data?.message ?? error?.data?.message ?? error?.statusMessage;
    const userError = knownError
      ? String(knownError)
      : `La consulta fallo durante la etapa ${routerStage}. El detalle tecnico quedo registrado.`;

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

    if (conversationId && !assistantMessagePersisted) {
      try {
        await insertConversationMessage("assistant", userError);
        assistantMessagePersisted = true;
      } catch {
        // no-op
      }
    }

    if (wantsStream) {
      sseWrite({
        tipo: "error",
        answer: userError,
        respuesta: userError,
        final: true
      }, "answer");
      sseWrite("done", "end");
      event.node.res.end();
      return;
    }

    return {
      tipo: "error",
      answer: userError,
      respuesta: userError
    };
  }
});

