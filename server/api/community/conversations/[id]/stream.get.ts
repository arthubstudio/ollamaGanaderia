import { createEventStream } from "h3";
import { readCommunityConversation } from "~/server/services/community";
import { requireUserId } from "~/server/utils/session";
import { apiError } from "~/server/utils/api";
import {
  releaseRealtimeConnection,
  tryAcquireRealtimeConnection
} from "~/server/utils/realtimeLimits";

export default defineEventHandler(async (event) => {
  const userId = requireUserId(event);
  const conversationId = String(event.context.params?.id ?? "");
  let lastId = Math.max(Number(getQuery(event).after) || 0, 0);
  const initialMessages = await readCommunityConversation(userId, conversationId, lastId);
  const connectionKey = `sse:user:${userId}`;
  if (!tryAcquireRealtimeConnection(connectionKey, 4)) {
    apiError({ statusCode: 429, code: "REALTIME_LIMITED", message: "Hay demasiadas conexiones en tiempo real abiertas." });
  }
  const stream = createEventStream(event);
  let released = false;
  let heartbeat = 0;
  let pendingInitial = initialMessages;

  const publish = async () => {
    const messages = pendingInitial;
    pendingInitial = [];
    const currentMessages = messages.length
      ? messages
      : await readCommunityConversation(userId, conversationId, lastId);
    if (currentMessages.length) {
      lastId = Number(currentMessages[currentMessages.length - 1].id);
      await stream.push({ event: "messages", id: String(lastId), data: JSON.stringify(currentMessages) });
    } else if (++heartbeat % 8 === 0) {
      await stream.push({ event: "heartbeat", data: String(Date.now()) });
    }
  };

  const interval = setInterval(() => publish().catch(() => null), 2000);
  const initialPublish = setTimeout(() => publish().catch(() => null), 0);
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
