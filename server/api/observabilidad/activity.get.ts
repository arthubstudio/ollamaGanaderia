import { sql } from "~/lib/db";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const userId = requireUserId(event);
  return sql`
    SELECT a.*, actor.nombre AS actor_name
    FROM activity_audit_logs a
    LEFT JOIN usuarios actor ON actor.id = a.actor_user_id
    WHERE a.actor_user_id = ${userId}
       OR (
         a.entity_type = 'bovino_transfer'
         AND a.entity_id IN (
           SELECT id::text FROM bovino_transfers
           WHERE source_user_id = ${userId} OR destination_user_id = ${userId}
         )
       )
    ORDER BY a.id DESC
    LIMIT 200
  `;
}));

