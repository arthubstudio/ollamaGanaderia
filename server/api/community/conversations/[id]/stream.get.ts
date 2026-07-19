import { createEventStream } from "h3";
import { readCommunityConversation } from "~/server/services/community";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = requireUserId(event);
  const conversationId = String(event.context.params?.id ?? "");
  const stream = createEventStream(event);
  let lastId = Math.max(Number(getQuery(event).after) || 0, 0);
  let heartbeat = 0;

  const publish = async () => {
    const messages = await readCommunityConversation(userId, conversationId, lastId);
    if (messages.length) {
      lastId = Number(messages[messages.length - 1].id);
      await stream.push({ event: "messages", id: String(lastId), data: JSON.stringify(messages) });
    } else if (++heartbeat % 8 === 0) {
      await stream.push({ event: "heartbeat", data: String(Date.now()) });
    }
  };

  await publish();
  const interval = setInterval(() => publish().catch(() => null), 2000);
  stream.onClosed(async () => {
    clearInterval(interval);
    await stream.close();
  });
  return stream.send();
});

