import { sql } from "~/lib/db";
import { parseId, runApi } from "~/server/utils/api";
import { requireOwnedBovino } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const bovinoId = parseId(getQuery(event).bovino_id, "bovino_id");
  await requireOwnedBovino(bovinoId, userId);
  return sql`
    SELECT va.*, v.nombre AS vacuna_nombre
    FROM vacuna_aplicada va JOIN vacunas v ON v.id = va.vacuna_id
    WHERE va.bovino_id = ${bovinoId} AND v.usuario_id = ${userId}
    ORDER BY va.fecha_aplicacion DESC NULLS LAST, va.id DESC
  `;
}));
