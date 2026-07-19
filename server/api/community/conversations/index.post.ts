import { getOrCreateDirectConversation } from "~/server/services/community";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const body = await readBody(event);
  return getOrCreateDirectConversation(requireUserId(event), body?.contact_user_id);
}));

