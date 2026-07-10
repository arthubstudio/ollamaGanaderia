import { sql } from "~/lib/db";
import { apiError, optionalDate, optionalText, parseId, positiveNumber, requiredText, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const body = await readBody(event);
  const rows = await sql`
    UPDATE ventas v SET comprador = ${requiredText(body?.comprador, "comprador", 100)},
      precio = ${positiveNumber(body?.precio, "El precio")},
      fecha = ${optionalDate(body?.fecha, "La fecha") ?? new Date().toISOString().slice(0, 10)},
      observaciones = ${optionalText(body?.observaciones)}
    FROM bovinos b WHERE v.id = ${id} AND b.id = v.bovino_id AND b.usuario_id = ${userId}
    RETURNING v.*
  `;
  if (!rows.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Venta no encontrada." });
  return rows[0];
}));
