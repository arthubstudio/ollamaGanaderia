import { markCommunityConversationRead } from "~/server/services/community";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const body = await readBody(event);
  return markCommunityConversationRead(
    requireUserId(event),
    event.context.params?.id,
    body?.message_id
  );
}));
