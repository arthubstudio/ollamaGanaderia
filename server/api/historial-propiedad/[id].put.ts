import { sql } from "~/lib/db";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { apiError, optionalDate, optionalId, optionalText, parseId, requiredDate, runApi } from "~/server/utils/api";
import { requireOwnedDueno, requireOwnedRancho } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const body = await readBody(event);
  const duenoId = optionalId(body?.dueno_id, "dueno_id");
  const ranchoId = optionalId(body?.rancho_id, "rancho_id");
  if (duenoId) await requireOwnedDueno(duenoId, userId);
  if (ranchoId) await requireOwnedRancho(ranchoId, userId);
  const rows = await sql`
    UPDATE historial_propiedad hp SET dueno_id = ${duenoId}, rancho_id = ${ranchoId},
      fecha_inicio = ${requiredDate(body?.fecha_inicio, "La fecha de inicio")},
      fecha_fin = ${optionalDate(body?.fecha_fin, "La fecha de fin")},
      observaciones = ${optionalText(body?.observaciones)}
    FROM bovinos b
    WHERE hp.id = ${id} AND b.id = hp.bovino_id AND b.usuario_id = ${userId}
    RETURNING hp.*
  `;
  if (!rows.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Historial no encontrado." });
  await rebuildBovinoContext(Number(rows[0].bovino_id));
  return rows[0];
}));
