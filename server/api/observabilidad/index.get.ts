import { sql } from "~/lib/db";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

function sanitizeTools(raw: unknown) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return "[]";

    return JSON.stringify(parsed.map((tool) => ({
      name: String(tool?.name ?? "unknown").slice(0, 100),
      status: tool?.status === "SUCCESS" ? "SUCCESS" : "ERROR"
    })));
  } catch {
    return "[]";
  }
}

export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const rows = await sql`
    SELECT
      id,
      session_id,
      timestamp,
      prompt_hash,
      response_hash,
      prompt_length,
      response_length,
      ttft_ms,
      total_latency_ms,
      tokens_per_second,
      was_blocked,
      tools_executed,
      selected_agent,
      intent,
      confidence,
      retrieved_count,
      reranked_count,
      reranker_used,
      retrieval_latency_ms,
      rerank_latency_ms
    FROM ai_logs
    WHERE session_id = ${`user:${userId}`}
       OR session_id IN (SELECT id::text FROM conversations WHERE usuario_id = ${userId})
    ORDER BY id DESC LIMIT 100
  `;

  return rows.map((row) => ({
    ...row,
    session_id: null,
    user_prompt: null,
    system_response: null,
    tools_executed: sanitizeTools(row.tools_executed),
    details_redacted: true
  }));
}));
