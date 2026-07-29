import { searchUsers } from "~/server/services/userDirectory";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
import { enforceRateLimit } from "~/server/utils/rateLimit";

export default defineEventHandler((event) => runApi(async () => {
  const userId = requireUserId(event);
  await enforceRateLimit(event, {
    key: `directory:search:user:${userId}`,
    limit: 30,
    windowMs: 60 * 1000,
    message: "Espera un momento antes de realizar mas busquedas."
  });
  const query = getQuery(event);
  return searchUsers(query.q, userId, Number(query.limit) || 8);
}));
