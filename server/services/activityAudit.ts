import { createHash } from "node:crypto";
import { sql } from "~/lib/db";

type AuditSql = typeof sql;

function redactValue(value: unknown) {
  const text = String(value ?? "");
  return {
    redacted: true,
    length: text.length,
    sha256: createHash("sha256").update(text).digest("hex")
  };
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[MAX_DEPTH]";
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeMetadata(item, depth + 1));
  if (!value || typeof value !== "object") return String(value ?? "").slice(0, 500);

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
    const normalizedKey = key.toLowerCase();
    if (
      !normalizedKey.endsWith("_hash") &&
      /(^|_)(email|password|secret|token|prompt|response|content|query|message|name|nombre|recipient_key|directory_key)($|_)/.test(normalizedKey)
    ) {
      output[key] = redactValue(item);
    } else {
      output[key] = sanitizeMetadata(item, depth + 1);
    }
  }
  return output;
}

export async function recordActivity(input: {
  actorUserId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  success?: boolean;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
  client?: AuditSql | any;
}) {
  const client = input.client ?? sql;
  const sanitized = sanitizeMetadata(input.metadata ?? {});
  let metadata = JSON.stringify(sanitized);
  if (metadata.length > 12_000) {
    metadata = JSON.stringify({
      truncated: true,
      sha256: createHash("sha256").update(metadata).digest("hex")
    });
  }

  await client`
    INSERT INTO activity_audit_logs (
      actor_user_id, action, entity_type, entity_id,
      success, duration_ms, metadata
    ) VALUES (
      ${input.actorUserId ?? null}, ${input.action}, ${input.entityType},
      ${input.entityId == null ? null : String(input.entityId)},
      ${input.success ?? true}, ${input.durationMs ?? null}, ${metadata}::jsonb
    )
  `;
}
