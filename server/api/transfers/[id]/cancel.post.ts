import { cancelBovinoTransfer } from "~/server/services/accountTransfer";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () =>
  cancelBovinoTransfer(requireUserId(event), event.context.params?.id)
));

