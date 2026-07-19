import { rejectBovinoTransfer } from "~/server/services/accountTransfer";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () =>
  rejectBovinoTransfer(requireUserId(event), event.context.params?.id)
));

