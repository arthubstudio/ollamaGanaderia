import { markNotificationRead } from "~/server/services/notifications";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () =>
  markNotificationRead(requireUserId(event), event.context.params?.id)
));

