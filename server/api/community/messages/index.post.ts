import { sendCommunityMessage } from "~/server/services/community";
import { publishPersistedCommunityMessage } from "~/server/services/communityRealtime";
import { runApi } from "~/server/utils/api";
import { safeErrorDetails } from "~/server/utils/safeLogging";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const body = await readBody(event);
  const message = await sendCommunityMessage({
    userId: requireUserId(event),
    conversationId: body?.conversation_id,
    contactUserId: body?.contact_user_id,
    content: body?.content,
    clientMessageId: body?.client_message_id
  });
  await publishPersistedCommunityMessage(message).catch((error) => {
    console.error("No se pudo publicar el mensaje por WebSocket", safeErrorDetails(error));
  });
  return message;
}));
