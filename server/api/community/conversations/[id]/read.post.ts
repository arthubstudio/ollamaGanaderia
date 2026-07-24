import { markCommunityConversationRead } from "~/server/services/community";
import { publishCommunityReadResult } from "~/server/services/communityRealtime";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const body = await readBody(event);
  const userId = requireUserId(event);
  const result = await markCommunityConversationRead(
    userId,
    event.context.params?.id,
    body?.message_id
  );
  await publishCommunityReadResult(userId, result).catch((error) => {
    console.error("No se pudo publicar la lectura por WebSocket:", error);
  });
  return result;
}));
