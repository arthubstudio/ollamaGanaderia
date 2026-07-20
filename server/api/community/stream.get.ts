import { createEventStream } from "h3";
import { listCommunityUpdates } from "~/server/services/community";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = requireUserId(event);
  const stream = createEventStream(event);
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
    console.error("Error publicando el stream comunitario:", error);
  }), 1500);
  const initialPublish = setTimeout(() => publish().catch((error) => {
    console.error("Error iniciando el stream comunitario:", error);
  }), 0);

  stream.onClosed(async () => {
    clearTimeout(initialPublish);
    clearInterval(interval);
    await stream.close();
  });

  return stream.send();
});
