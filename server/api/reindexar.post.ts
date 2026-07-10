import { sql } from "~/lib/db";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const bovinos = await sql`SELECT id FROM bovinos WHERE usuario_id = ${userId}`;
  for (const bovino of bovinos) await rebuildBovinoContext(Number(bovino.id));
  return { success: true, total: bovinos.length };
}));
