import { parseId, runApi } from "~/server/utils/api";
import { requireOwnedVacuna } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () =>
  requireOwnedVacuna(parseId(event.context.params?.id), requireUserId(event))
));
