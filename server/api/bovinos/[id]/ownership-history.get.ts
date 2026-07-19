import { getBovinoOwnershipTimeline } from "~/server/services/accountTransfer";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () =>
  getBovinoOwnershipTimeline(requireUserId(event), event.context.params?.id)
));

