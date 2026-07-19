import { listBovinoTransfers } from "~/server/services/accountTransfer";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const userId = requireUserId(event);
  const query = getQuery(event);
  return listBovinoTransfers(userId, query.direction, query.status);
}));

