import { sql } from "~/lib/db";
import { optionalId, optionalText, requiredText, runApi } from "~/server/utils/api";
import { requireOwnedDueno } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const duenoId = optionalId(body?.dueno_id, "dueno_id");
  if (duenoId) await requireOwnedDueno(duenoId, userId);
  const rows = await sql`
    INSERT INTO ranchos (usuario_id, nombre, ubicacion, dueno_id)
    VALUES (${userId}, ${requiredText(body?.nombre, "nombre", 100)},
      ${optionalText(body?.ubicacion)}, ${duenoId}) RETURNING *
  `;
  return rows[0];
}));
