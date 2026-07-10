import { sql } from "~/lib/db";
import { optionalText, requiredText, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const rows = await sql`
    INSERT INTO duenos (usuario_id, nombre, telefono, direccion)
    VALUES (${userId}, ${requiredText(body?.nombre, "nombre", 100)},
      ${optionalText(body?.telefono, 50)}, ${optionalText(body?.direccion)})
    RETURNING *
  `;
  return rows[0];
}));
