import { parseId, runApi } from "~/server/utils/api";
import { requireOwnedRancho } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () =>
  requireOwnedRancho(parseId(event.context.params?.id), requireUserId(event))
));
