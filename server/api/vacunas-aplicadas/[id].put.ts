import { sql } from "~/lib/db";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { apiError, optionalDate, optionalText, parseId, runApi } from "~/server/utils/api";
import { requireOwnedVacuna } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const body = await readBody(event);
  const vacunaId = parseId(body?.vacuna_id, "vacuna_id");
  await requireOwnedVacuna(vacunaId, userId);
  const rows = await sql`
    UPDATE vacuna_aplicada va SET vacuna_id = ${vacunaId},
      fecha_aplicacion = ${optionalDate(body?.fecha_aplicacion, "La fecha de aplicacion")},
      veterinario = ${optionalText(body?.veterinario, 100)},
      observaciones = ${optionalText(body?.observaciones)}
    FROM bovinos b
    WHERE va.id = ${id} AND b.id = va.bovino_id AND b.usuario_id = ${userId}
    RETURNING va.*
  `;
  if (!rows.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Vacuna aplicada no encontrada." });
  await rebuildBovinoContext(Number(rows[0].bovino_id));
  return rows[0];
}));
