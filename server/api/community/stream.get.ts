import { createEventStream } from "h3";
import { listCommunityUpdates } from "~/server/services/community";
import { requireUserId } from "~/server/utils/session";
import { apiError } from "~/server/utils/api";
import { safeErrorDetails } from "~/server/utils/safeLogging";
import {
  releaseRealtimeConnection,
  tryAcquireRealtimeConnection
} from "~/server/utils/realtimeLimits";

export default defineEventHandler(async (event) => {
  const userId = requireUserId(event);
  const connectionKey = `sse:user:${userId}`;
  if (!tryAcquireRealtimeConnection(connectionKey, 4)) {
    apiError({ statusCode: 429, code: "REALTIME_LIMITED", message: "Hay demasiadas conexiones en tiempo real abiertas." });
  }
  const stream = createEventStream(event);
  let released = false;
  let cursor = Math.max(Number(getQuery(event).after) || 0, 0);
  let previousConversations = "";
  let heartbeat = 0;

  const publish = async () => {
    const updates = await listCommunityUpdates(userId, cursor);
    const conversationSnapshot = JSON.stringify(updates.conversations);
    const changed = updates.messages.length > 0 || conversationSnapshot !== previousConversations;

    cursor = Math.max(cursor, Number(updates.cursor) || 0);
    previousConversations = conversationSnapshot;

    if (changed) {
      await stream.push({
        event: "community",
        id: String(cursor),
        data: JSON.stringify({ ...updates, cursor })
      });
    } else if (++heartbeat % 8 === 0) {
      await stream.push({ event: "heartbeat", data: String(Date.now()) });
    }
  };

  const interval = setInterval(() => publish().catch((error) => {
    console.error("Error publicando el stream comunitario", safeErrorDetails(error));
  }), 1500);
  const initialPublish = setTimeout(() => publish().catch((error) => {
    console.error("Error iniciando el stream comunitario", safeErrorDetails(error));
  }), 0);

  stream.onClosed(async () => {
    clearTimeout(initialPublish);
    clearInterval(interval);
    if (!released) {
      released = true;
      releaseRealtimeConnection(connectionKey);
    }
    await stream.close();
  });

  return stream.send();
});
