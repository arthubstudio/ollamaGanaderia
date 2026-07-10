import { parseId, runApi } from "~/server/utils/api";
import { requireOwnedDueno } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () =>
  requireOwnedDueno(parseId(event.context.params?.id), requireUserId(event))
));
