import { sql } from "~/lib/db";
import { optionalDate, optionalText, parseId, positiveNumber, requiredText, runApi } from "~/server/utils/api";
import { requireOwnedBovino } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const bovinoId = parseId(body?.bovino_id, "bovino_id");
  await requireOwnedBovino(bovinoId, userId);
  return sql.begin(async (tx) => {
    const rows = await tx`
      INSERT INTO ventas (bovino_id, comprador, precio, fecha, observaciones)
      VALUES (${bovinoId}, ${requiredText(body?.comprador, "comprador", 100)},
        ${positiveNumber(body?.precio, "El precio")},
        ${optionalDate(body?.fecha, "La fecha") ?? new Date().toISOString().slice(0, 10)},
        ${optionalText(body?.observaciones)}) RETURNING *
    `;
    await tx`UPDATE bovinos SET estado = 'vendida', updated_at = NOW() WHERE id = ${bovinoId} AND usuario_id = ${userId}`;
    return rows[0];
  });
}));
