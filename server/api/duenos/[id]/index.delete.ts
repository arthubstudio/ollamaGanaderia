import { sql } from "~/lib/db";
import { parseId, runApi } from "~/server/utils/api";
import { requireOwnedDueno } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  await requireOwnedDueno(id, userId);
  await sql`DELETE FROM duenos WHERE id = ${id} AND usuario_id = ${userId}`;
  return { success: true };
}));
