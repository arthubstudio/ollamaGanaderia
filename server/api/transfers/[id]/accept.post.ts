import { acceptBovinoTransfer } from "~/server/services/accountTransfer";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event).catch(() => ({}));
  return acceptBovinoTransfer(userId, event.context.params?.id, body?.destination_rancho_id);
}));

