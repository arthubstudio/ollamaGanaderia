import { searchUsers } from "~/server/services/userDirectory";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const userId = requireUserId(event);
  const query = getQuery(event);
  return searchUsers(query.q, userId, Number(query.limit) || 10);
}));

