import { sql } from "~/lib/db";
import { optionalId, optionalText, parseId, requiredText, runApi } from "~/server/utils/api";
import { requireOwnedDueno, requireOwnedRancho } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const body = await readBody(event);
  await requireOwnedRancho(id, userId);
  const duenoId = optionalId(body?.dueno_id, "dueno_id");
  if (duenoId) await requireOwnedDueno(duenoId, userId);
  const rows = await sql`
    UPDATE ranchos SET nombre = ${requiredText(body?.nombre, "nombre", 100)},
      ubicacion = ${optionalText(body?.ubicacion)}, dueno_id = ${duenoId}
    WHERE id = ${id} AND usuario_id = ${userId} RETURNING *
  `;
  return rows[0];
}));
