import { sendFriendRequest } from "~/server/services/community";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const body = await readBody(event);
  return sendFriendRequest({
    senderUserId: requireUserId(event),
    recipientQuery: body?.usuario_destino ?? body?.email,
    message: body?.message
  });
}));

