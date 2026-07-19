import { sql } from "~/lib/db";

type AuditSql = typeof sql;

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
  const metadata = JSON.stringify(input.metadata ?? {});

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

