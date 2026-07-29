import { sql } from "~/lib/db";
import { detectPromptInjection, GUARDRAIL_BLOCKED_MESSAGE } from "~/server/lib/guardrails";
import { runRagAgent } from "~/server/ai/agents/ragAgent";
import { routeIaMessage } from "~/server/ai/agents/routerAgent";
import { buildAgentContext } from "~/server/ai/context/agentContext";
import { apiError } from "~/server/utils/api";
import { parseIaMessage } from "~/server/utils/iaRequest";
import {
  enforceRateLimit,
  rateLimitKeyPart
} from "~/server/utils/rateLimit";
import { requireUserId } from "~/server/utils/session";
import { hashAuditText } from "~/server/utils/aiAudit";

type EvaluateBody = {
  message?: string;
  usuario_id?: number | string;
  conversation_id?: string | null;
};

function parseTools(raw: unknown) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];

    const names = new Set<string>();
    for (const item of parsed) {
      if (item?.name) names.add(String(item.name));
      if (item?.result?.tool) names.add(String(item.result.tool));
      if (item?.result?.resultado?.tool) names.add(String(item.result.resultado.tool));
    }
    return [...names];
  } catch {
    return [];
  }
}

export default defineEventHandler(async (event) => {
  const startedAt = Date.now();
  const body = await readBody<EvaluateBody>(event);
  const usuarioId = requireUserId(event);
  await enforceRateLimit(event, {
    key: `ia:evaluate:user:${rateLimitKeyPart(usuarioId)}`,
    limit: 30,
    windowMs: 60 * 1000,
    message: "Se alcanzo el limite temporal del evaluador de IA."
  });
  const parsedRequest = parseIaMessage(body, { field: "message" });
  const message = parsedRequest.message;
  const conversationId = parsedRequest.conversationId;

  if (body?.usuario_id != null && Number(body.usuario_id) !== usuarioId) {
    apiError({ statusCode: 403, code: "FORBIDDEN", message: "El usuario no coincide con la sesion autenticada." });
  }

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

  const recentMessages = conversationId
    ? await sql`
        SELECT role, content
        FROM conversation_messages
        WHERE conversation_id = ${conversationId}
        ORDER BY id DESC
        LIMIT 8
      `
    : [];
  recentMessages.reverse();

  const route = routeIaMessage(message, recentMessages);

  if (detectPromptInjection(message)) {
    return {
      answer: GUARDRAIL_BLOCKED_MESSAGE,
      route: {
        agent: "direct",
        intent: "security_block",
        confidence: 1,
        reason: "El guardrail detecto una instruccion potencialmente peligrosa."
      },
      retrieved_context: [],
      tools_executed: ["guardrail.prompt_injection"],
      blocked: true,
      metrics: {
        ttft_ms: 0,
        total_latency_ms: Date.now() - startedAt,
        retrieval_latency_ms: 0,
        rerank_latency_ms: 0
      }
    };
  }

  if (route.agent === "rag") {
    const context = buildAgentContext({
      conversationId,
      recentMessages,
      currentMessage: message
    });
    const rag = await runRagAgent({
      query: message,
      usuarioId,
      context,
      stream: false
    });

    return {
      answer: rag.answer,
      route,
      retrieved_context: rag.retrievedContext,
      tools_executed: [
        "rag.hybrid_search",
        ...(rag.metrics.rerankerUsed ? ["rag.reranker"] : ["rag.rrf_fallback"]),
        "ollama.chat"
      ],
      blocked: false,
      metrics: {
        ttft_ms: rag.metrics.ttftMs,
        total_latency_ms: Date.now() - startedAt,
        retrieval_latency_ms: rag.metrics.retrievalLatencyMs,
        rerank_latency_ms: rag.metrics.rerankLatencyMs
      }
    };
  }

  const routerResponse: any = await event.$fetch("/api/ia/router", {
    method: "POST",
    body: {
      pregunta: message,
      conversation_id: conversationId,
      stream: false
    }
  });

  const sessionId = conversationId ?? `user:${usuarioId}`;
  const logRows = await sql`
    SELECT ttft_ms, total_latency_ms, tools_executed, was_blocked
    FROM ai_logs
    WHERE session_id = ${sessionId}
      AND prompt_hash = ${hashAuditText(message)}
    ORDER BY id DESC
    LIMIT 1
  `;
  const log = logRows[0] ?? {};

  return {
    answer: routerResponse?.respuesta ?? "",
    route,
    retrieved_context: [],
    tools_executed: parseTools(log.tools_executed),
    blocked: Boolean(log.was_blocked),
    metrics: {
      ttft_ms: Number(log.ttft_ms) || 0,
      total_latency_ms: Number(log.total_latency_ms) || Date.now() - startedAt,
      retrieval_latency_ms: 0,
      rerank_latency_ms: 0
    }
  };
});
