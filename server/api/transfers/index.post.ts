import { createBovinoTransfer } from "~/server/services/accountTransfer";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const sourceUserId = requireUserId(event);
  const body = await readBody(event);
  return createBovinoTransfer({
    sourceUserId,
    bovinoId: body?.bovino_id,
    bovinoName: body?.bovino_nombre,
    destinationQuery: body?.usuario_destino ?? body?.destination_email,
    destinationRanchoId: body?.destination_rancho_id,
    message: body?.message
  });
}));

