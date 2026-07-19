import { sql } from "~/lib/db";
import { apiError, parseId } from "~/server/utils/api";

export async function listNotifications(userId: number, unreadOnly = false, limitValue: unknown = 100) {
  const limit = Math.min(Math.max(Number(limitValue) || 100, 1), 200);
  const items = await sql`
    SELECT
      n.*,
      actor.nombre AS actor_name,
      actor.email AS actor_email,
      (nr.notification_id IS NOT NULL) AS is_read,
      nr.read_at
    FROM notifications n
    LEFT JOIN notification_reads nr
      ON nr.notification_id = n.id AND nr.user_id = ${userId}
    LEFT JOIN usuarios actor ON actor.id = n.actor_user_id
    WHERE n.user_id = ${userId}
      AND (${unreadOnly} = FALSE OR nr.notification_id IS NULL)
    ORDER BY n.created_at DESC
    LIMIT ${limit}
  `;
  const unread = await sql`
    SELECT COUNT(*)::integer AS total
    FROM notifications n
    LEFT JOIN notification_reads nr
      ON nr.notification_id = n.id AND nr.user_id = ${userId}
    WHERE n.user_id = ${userId} AND nr.notification_id IS NULL
  `;
  return { items, unread_count: Number(unread[0]?.total ?? 0) };
}

export async function markNotificationRead(userId: number, notificationIdValue: unknown) {
  const notificationId = parseId(notificationIdValue, "notification_id");
  const owner = await sql`
    SELECT id FROM notifications WHERE id = ${notificationId} AND user_id = ${userId}
  `;
  if (!owner.length) {
    apiError({ statusCode: 404, code: "NOT_FOUND", message: "Notificacion no encontrada." });
  }
  const rows = await sql`
    INSERT INTO notification_reads (notification_id, user_id)
    VALUES (${notificationId}, ${userId})
    ON CONFLICT (notification_id, user_id)
    DO UPDATE SET read_at = notification_reads.read_at
    RETURNING *
  `;
  return rows[0];
}

export async function markAllNotificationsRead(userId: number) {
  const rows = await sql`
    INSERT INTO notification_reads (notification_id, user_id)
    SELECT id, ${userId} FROM notifications WHERE user_id = ${userId}
    ON CONFLICT (notification_id, user_id) DO NOTHING
    RETURNING notification_id
  `;
  return { marked: rows.length };
}

