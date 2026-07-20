import { sql } from "~/lib/db";
import { recordActivity } from "~/server/services/activityAudit";
import { resolveExactUser, resolveSingleUser } from "~/server/services/userDirectory";
import { apiError, optionalText, parseId, requiredText } from "~/server/utils/api";

function pair(userA: number, userB: number) {
  return userA < userB ? [userA, userB] : [userB, userA];
}

export async function areFriends(userA: number, userB: number, client: any = sql) {
  const [low, high] = pair(userA, userB);
  const rows = await client`
    SELECT id FROM friendships
    WHERE user_low_id = ${low} AND user_high_id = ${high}
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function sendFriendRequest(input: {
  senderUserId: number;
  recipientQuery: unknown;
  message?: unknown;
}) {
  const recipient = await resolveExactUser(input.recipientQuery, input.senderUserId);
  if (recipient.status === "self") {
    return { ok: false as const, reason: "self_request" as const, user: recipient.user, matches: recipient.matches };
  }
  if (recipient.status !== "found") {
    return { ok: false as const, reason: recipient.status, matches: recipient.matches };
  }
  if (await areFriends(input.senderUserId, recipient.user.id)) {
    return { ok: false as const, reason: "already_friends" as const, user: recipient.user };
  }

  const existingPending = await sql`
    SELECT * FROM friend_requests
    WHERE status = 'PENDING'
      AND sender_user_id = ${input.senderUserId}
      AND receiver_user_id = ${recipient.user.id}
    LIMIT 1
  `;
  if (existingPending.length) {
    return { ok: false as const, reason: "already_pending" as const, request: existingPending[0], user: recipient.user };
  }

  const inverse = await sql`
    SELECT id FROM friend_requests
    WHERE status = 'PENDING'
      AND sender_user_id = ${recipient.user.id}
      AND receiver_user_id = ${input.senderUserId}
    LIMIT 1
  `;
  if (inverse.length) {
    const friendship = await acceptFriendRequest(input.senderUserId, Number(inverse[0].id));
    return { ok: true as const, autoAccepted: true, friendship, user: recipient.user };
  }

  const request = await sql.begin(async (tx) => {
    const rows = await tx`
      INSERT INTO friend_requests (sender_user_id, receiver_user_id, message)
      VALUES (${input.senderUserId}, ${recipient.user.id}, ${optionalText(input.message, 500)})
      ON CONFLICT DO NOTHING
      RETURNING *
    `;
    const created = rows[0];
    if (!created) return null;
    await tx`
      INSERT INTO notifications (
        user_id, actor_user_id, type, title, body, entity_type, entity_id
      ) VALUES (
        ${recipient.user.id}, ${input.senderUserId}, 'FRIEND_REQUEST',
        'Nueva solicitud de contacto',
        'Un ganadero quiere agregarte a sus contactos.',
        'friend_request', ${String(created.id)}
      )
    `;
    await recordActivity({
      actorUserId: input.senderUserId,
      action: "friend.requested",
      entityType: "friend_request",
      entityId: created.id,
      metadata: { receiver_user_id: recipient.user.id },
      client: tx
    });
    return created;
  });

  if (!request) {
    const pending = await sql`
      SELECT * FROM friend_requests
      WHERE status = 'PENDING'
        AND LEAST(sender_user_id, receiver_user_id) = LEAST(${input.senderUserId}, ${recipient.user.id})
        AND GREATEST(sender_user_id, receiver_user_id) = GREATEST(${input.senderUserId}, ${recipient.user.id})
      LIMIT 1
    `;
    return {
      ok: false as const,
      reason: "already_pending" as const,
      request: pending[0] ?? null,
      user: recipient.user
    };
  }

  return { ok: true as const, request, user: recipient.user };
}

export async function listFriendRequests(userId: number) {
  return sql`
    SELECT
      fr.*,
      su.nombre AS sender_name, su.email AS sender_email,
      ru.nombre AS receiver_name, ru.email AS receiver_email,
      CASE WHEN fr.sender_user_id = ${userId} THEN 'sent' ELSE 'received' END AS direction
    FROM friend_requests fr
    JOIN usuarios su ON su.id = fr.sender_user_id
    JOIN usuarios ru ON ru.id = fr.receiver_user_id
    WHERE fr.sender_user_id = ${userId} OR fr.receiver_user_id = ${userId}
    ORDER BY fr.created_at DESC
    LIMIT 200
  `;
}

export async function acceptFriendRequest(userId: number, requestIdValue: unknown) {
  const requestId = parseId(requestIdValue, "request_id");
  return sql.begin(async (tx) => {
    const rows = await tx`SELECT * FROM friend_requests WHERE id = ${requestId} FOR UPDATE`;
    const request = rows[0];
    if (!request || Number(request.receiver_user_id) !== userId) {
      apiError({ statusCode: 404, code: "NOT_FOUND", message: "Solicitud no encontrada." });
    }
    if (request.status !== "PENDING") {
      apiError({ statusCode: 409, code: "INVALID_REQUEST_STATUS", message: "La solicitud ya fue respondida." });
    }
    const [low, high] = pair(Number(request.sender_user_id), Number(request.receiver_user_id));
    const friendship = await tx`
      INSERT INTO friendships (user_low_id, user_high_id, created_from_request_id)
      VALUES (${low}, ${high}, ${requestId})
      ON CONFLICT (user_low_id, user_high_id)
      DO UPDATE SET created_from_request_id = COALESCE(friendships.created_from_request_id, EXCLUDED.created_from_request_id)
      RETURNING *
    `;
    await tx`
      UPDATE friend_requests SET status = 'ACCEPTED', responded_at = NOW()
      WHERE id = ${requestId}
    `;
    await tx`
      INSERT INTO notifications (
        user_id, actor_user_id, type, title, body, entity_type, entity_id
      ) VALUES (
        ${request.sender_user_id}, ${userId}, 'FRIEND_REQUEST_ACCEPTED',
        'Solicitud de contacto aceptada',
        'Ya pueden iniciar una conversacion.',
        'friendship', ${String(friendship[0].id)}
      )
    `;
    await recordActivity({
      actorUserId: userId,
      action: "friend.accepted",
      entityType: "friend_request",
      entityId: requestId,
      client: tx
    });
    return friendship[0];
  });
}

export async function rejectFriendRequest(userId: number, requestIdValue: unknown) {
  const requestId = parseId(requestIdValue, "request_id");
  const rows = await sql`
    UPDATE friend_requests SET status = 'REJECTED', responded_at = NOW()
    WHERE id = ${requestId} AND receiver_user_id = ${userId} AND status = 'PENDING'
    RETURNING *
  `;
  if (!rows.length) {
    apiError({ statusCode: 404, code: "NOT_FOUND", message: "Solicitud pendiente no encontrada." });
  }
  await recordActivity({ actorUserId: userId, action: "friend.rejected", entityType: "friend_request", entityId: requestId });
  return rows[0];
}

export async function listFriends(userId: number) {
  return sql`
    SELECT
      f.id AS friendship_id,
      u.id, u.nombre, u.email,
      f.created_at
    FROM friendships f
    JOIN usuarios u ON u.id = CASE
      WHEN f.user_low_id = ${userId} THEN f.user_high_id
      ELSE f.user_low_id
    END
    WHERE f.user_low_id = ${userId} OR f.user_high_id = ${userId}
    ORDER BY u.nombre ASC
  `;
}

async function requireConversationMember(client: any, conversationId: string, userId: number) {
  const rows = await client`
    SELECT conversation_id FROM community_conversation_members
    WHERE conversation_id = ${conversationId} AND user_id = ${userId}
    LIMIT 1
  `;
  if (!rows.length) {
    apiError({ statusCode: 404, code: "NOT_FOUND", message: "Conversacion no encontrada." });
  }
}

export async function getOrCreateDirectConversation(userId: number, contactUserIdValue: unknown) {
  const contactUserId = parseId(contactUserIdValue, "contact_user_id");
  if (!(await areFriends(userId, contactUserId))) {
    apiError({ statusCode: 403, code: "CONTACT_REQUIRED", message: "Solo puedes conversar con tus contactos." });
  }

  return sql.begin(async (tx) => {
    const [userLowId, userHighId] = pair(userId, contactUserId);
    await tx`SELECT pg_advisory_xact_lock(${userLowId}::integer, ${userHighId}::integer)`;

    const existing = await tx`
      SELECT c.id
      FROM community_conversations c
      JOIN community_conversation_members me
        ON me.conversation_id = c.id AND me.user_id = ${userId}
      JOIN community_conversation_members other_member
        ON other_member.conversation_id = c.id AND other_member.user_id = ${contactUserId}
      WHERE c.kind = 'direct'
        AND (SELECT COUNT(*) FROM community_conversation_members cm WHERE cm.conversation_id = c.id) = 2
      LIMIT 1
    `;
    if (existing.length) return existing[0];

    const created = await tx`
      INSERT INTO community_conversations (created_by)
      VALUES (${userId}) RETURNING *
    `;
    await tx`
      INSERT INTO community_conversation_members (conversation_id, user_id)
      VALUES (${created[0].id}, ${userId}), (${created[0].id}, ${contactUserId})
    `;
    await recordActivity({ actorUserId: userId, action: "conversation.created", entityType: "community_conversation", entityId: created[0].id, client: tx });
    return created[0];
  });
}

export async function listCommunityConversations(userId: number) {
  return sql`
    SELECT
      c.id, c.updated_at,
      other_user.id AS contact_user_id,
      other_user.nombre AS contact_name,
      other_user.email AS contact_email,
      last_message.id AS last_message_id,
      last_message.content AS last_message,
      last_message.created_at AS last_message_at,
      COALESCE(unread.total, 0)::integer AS unread_count
    FROM community_conversations c
    JOIN community_conversation_members me
      ON me.conversation_id = c.id AND me.user_id = ${userId}
    JOIN community_conversation_members other_member
      ON other_member.conversation_id = c.id AND other_member.user_id <> ${userId}
    JOIN usuarios other_user ON other_user.id = other_member.user_id
    LEFT JOIN LATERAL (
      SELECT id, content, created_at
      FROM community_messages m
      WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
      ORDER BY m.id DESC LIMIT 1
    ) last_message ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS total
      FROM community_messages m
      WHERE m.conversation_id = c.id
        AND m.sender_user_id <> ${userId}
        AND m.deleted_at IS NULL
        AND m.id > COALESCE(me.last_read_message_id, 0)
    ) unread ON TRUE
    ORDER BY COALESCE(last_message.created_at, c.updated_at) DESC
  `;
}

export async function sendCommunityMessage(input: {
  userId: number;
  conversationId?: unknown;
  contactUserId?: unknown;
  content: unknown;
  clientMessageId?: unknown;
}) {
  const content = requiredText(input.content, "mensaje", 4000);
  const clientMessageId = optionalText(input.clientMessageId, 100);
  let conversationId = optionalText(input.conversationId, 100);
  if (!conversationId) {
    const conversation = await getOrCreateDirectConversation(input.userId, input.contactUserId);
    conversationId = String(conversation.id);
  }

  return sql.begin(async (tx) => {
    await requireConversationMember(tx, conversationId!, input.userId);
    const recipient = await tx`
      SELECT user_id FROM community_conversation_members
      WHERE conversation_id = ${conversationId} AND user_id <> ${input.userId}
      LIMIT 1
    `;
    if (!recipient.length || !(await areFriends(input.userId, Number(recipient[0].user_id), tx))) {
      apiError({ statusCode: 403, code: "CONTACT_REQUIRED", message: "El destinatario ya no es un contacto." });
    }

    const rows = await tx`
      INSERT INTO community_messages (conversation_id, sender_user_id, content)
      VALUES (${conversationId}, ${input.userId}, ${content})
      RETURNING *
    `;
    await tx`UPDATE community_conversations SET updated_at = NOW() WHERE id = ${conversationId}`;
    await tx`
      INSERT INTO notifications (
        user_id, actor_user_id, type, title, body, entity_type, entity_id,
        data
      ) VALUES (
        ${recipient[0].user_id}, ${input.userId}, 'COMMUNITY_MESSAGE',
        'Nuevo mensaje', ${content.slice(0, 180)},
        'community_conversation', ${conversationId},
        ${JSON.stringify({ conversation_id: conversationId, message_id: Number(rows[0].id) })}::jsonb
      )
    `;
    await recordActivity({ actorUserId: input.userId, action: "message.sent", entityType: "community_message", entityId: rows[0].id, metadata: { conversation_id: conversationId }, client: tx });
    return { ...rows[0], client_message_id: clientMessageId };
  });
}

export async function listCommunityUpdates(userId: number, afterValue?: unknown) {
  const after = Math.max(Number(afterValue) || 0, 0);
  const messages = await sql`
    SELECT m.id, m.conversation_id, m.sender_user_id, m.content, m.created_at,
           u.nombre AS sender_name,
           (m.sender_user_id = ${userId}) AS is_mine
    FROM community_messages m
    JOIN community_conversation_members member
      ON member.conversation_id = m.conversation_id AND member.user_id = ${userId}
    JOIN usuarios u ON u.id = m.sender_user_id
    WHERE m.deleted_at IS NULL AND m.id > ${after}
    ORDER BY m.id ASC
    LIMIT 200
  `;
  const cursor = Number(messages[messages.length - 1]?.id ?? after);
  const conversations = await listCommunityConversations(userId);
  return { cursor, messages, conversations };
}

export async function markCommunityConversationRead(
  userId: number,
  conversationIdValue: unknown,
  messageIdValue?: unknown
) {
  const conversationId = requiredText(conversationIdValue, "conversation_id", 100);
  return sql.begin(async (tx) => {
    await requireConversationMember(tx, conversationId, userId);
    const requestedId = Math.max(Number(messageIdValue) || 0, 0);
    const rows = await tx`
      SELECT COALESCE(MAX(id), 0)::bigint AS last_id
      FROM community_messages
      WHERE conversation_id = ${conversationId}
        AND deleted_at IS NULL
        AND (${requestedId} = 0 OR id <= ${requestedId})
    `;
    const lastId = Number(rows[0]?.last_id ?? 0);
    if (lastId) {
      await tx`
        UPDATE community_conversation_members
        SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), ${lastId})
        WHERE conversation_id = ${conversationId} AND user_id = ${userId}
      `;
    }
    return { conversation_id: conversationId, last_read_message_id: lastId };
  });
}

export async function readCommunityConversation(userId: number, conversationIdValue: unknown, afterValue?: unknown) {
  const conversationId = requiredText(conversationIdValue, "conversation_id", 100);
  const after = Math.max(Number(afterValue) || 0, 0);
  await requireConversationMember(sql, conversationId, userId);
  const messages = await sql`
    SELECT m.id, m.conversation_id, m.sender_user_id, m.content, m.created_at,
           u.nombre AS sender_name,
           (m.sender_user_id = ${userId}) AS is_mine
    FROM community_messages m
    JOIN usuarios u ON u.id = m.sender_user_id
    WHERE m.conversation_id = ${conversationId}
      AND m.deleted_at IS NULL
      AND m.id > ${after}
    ORDER BY m.id ASC
    LIMIT 200
  `;
  const lastId = Number(messages[messages.length - 1]?.id ?? 0);
  if (lastId) {
    await sql`
      UPDATE community_conversation_members
      SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), ${lastId})
      WHERE conversation_id = ${conversationId} AND user_id = ${userId}
    `;
  }
  return messages;
}
