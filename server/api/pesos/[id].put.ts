import { sql } from "~/lib/db";
import { apiError, optionalDate, parseId, positiveNumber, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const body = await readBody(event);
  const existing = await sql`
    SELECT p.id, p.bovino_id FROM pesos p
    JOIN bovinos b ON b.id = p.bovino_id
    WHERE p.id = ${id} AND b.usuario_id = ${userId} LIMIT 1
  `;
  if (!existing.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Peso no encontrado." });
  const rows = await sql`
    UPDATE pesos SET peso = ${positiveNumber(body?.peso, "El peso")},
      fecha = ${optionalDate(body?.fecha, "La fecha") ?? new Date().toISOString().slice(0, 10)}
    WHERE id = ${id} RETURNING *
  `;
  await rebuildBovinoContext(Number(existing[0].bovino_id));
  return rows[0];
}));
