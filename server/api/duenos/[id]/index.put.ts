import { sql } from "~/lib/db";
import { optionalText, parseId, requiredText, runApi } from "~/server/utils/api";
import { requireOwnedDueno } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const body = await readBody(event);
  await requireOwnedDueno(id, userId);
  const rows = await sql`
    UPDATE duenos SET nombre = ${requiredText(body?.nombre, "nombre", 100)},
      telefono = ${optionalText(body?.telefono, 50)}, direccion = ${optionalText(body?.direccion)}
    WHERE id = ${id} AND usuario_id = ${userId} RETURNING *
  `;
  return rows[0];
}));
