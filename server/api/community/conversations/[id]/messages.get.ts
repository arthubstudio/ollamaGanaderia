import { readCommunityConversation } from "~/server/services/community";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const query = getQuery(event);
  return readCommunityConversation(requireUserId(event), event.context.params?.id, query.after);
}));

