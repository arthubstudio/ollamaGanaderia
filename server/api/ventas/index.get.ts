import { sql } from "~/lib/db";
import { optionalId, runApi } from "~/server/utils/api";
import { requireOwnedBovino } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const bovinoId = optionalId(getQuery(event).bovino_id, "bovino_id");
  if (bovinoId) await requireOwnedBovino(bovinoId, userId);
  return bovinoId
    ? sql`SELECT v.* FROM ventas v JOIN bovinos b ON b.id = v.bovino_id WHERE b.usuario_id = ${userId} AND b.id = ${bovinoId} ORDER BY v.fecha DESC NULLS LAST, v.id DESC`
    : sql`SELECT v.* FROM ventas v JOIN bovinos b ON b.id = v.bovino_id WHERE b.usuario_id = ${userId} ORDER BY v.fecha DESC NULLS LAST, v.id DESC`;
}));
