import { sendCommunityMessage } from "~/server/services/community";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const body = await readBody(event);
  return sendCommunityMessage({
    userId: requireUserId(event),
    conversationId: body?.conversation_id,
    contactUserId: body?.contact_user_id,
    content: body?.content
  });
}));

