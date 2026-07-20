import { sendCommunityMessage } from "~/server/services/community";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const body = await readBody(event);
  return sendCommunityMessage({
    userId: requireUserId(event),
    conversationId: event.context.params?.id,
    content: body?.content,
    clientMessageId: body?.client_message_id
  });
}));
