import { sql } from "~/lib/db";
import { optionalDate, parseId, positiveNumber, runApi } from "~/server/utils/api";
import { requireOwnedBovino } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const bovinoId = parseId(body?.bovino_id, "bovino_id");
  await requireOwnedBovino(bovinoId, userId);
  const peso = positiveNumber(body?.peso, "El peso", 2500);
  const fecha = optionalDate(body?.fecha, "La fecha") ?? new Date().toISOString().slice(0, 10);
  const rows = await sql`
    INSERT INTO pesos (bovino_id, peso, fecha)
    VALUES (${bovinoId}, ${peso}, ${fecha}) RETURNING *
  `;
  await rebuildBovinoContext(bovinoId);
  return rows[0];
}));
