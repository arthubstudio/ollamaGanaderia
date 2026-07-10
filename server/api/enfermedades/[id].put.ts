import { sql } from "~/lib/db";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { apiError, optionalDate, optionalText, parseId, requiredText, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const body = await readBody(event);
  const rows = await sql`
    UPDATE enfermedades e SET
      nombre = ${requiredText(body?.nombre, "nombre", 100)},
      tratamiento = ${optionalText(body?.tratamiento)},
      fecha = ${optionalDate(body?.fecha, "La fecha")},
      veterinario = ${optionalText(body?.veterinario, 100)}
    FROM bovinos b
    WHERE e.id = ${id} AND b.id = e.bovino_id AND b.usuario_id = ${userId}
    RETURNING e.*
  `;
  if (!rows.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Enfermedad no encontrada." });
  await rebuildBovinoContext(Number(rows[0].bovino_id));
  return rows[0];
}));
