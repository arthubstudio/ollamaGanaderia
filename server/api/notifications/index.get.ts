import { listNotifications } from "~/server/services/notifications";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const userId = requireUserId(event);
  const query = getQuery(event);
  return listNotifications(userId, String(query.unread_only ?? "false") === "true", query.limit);
}));

