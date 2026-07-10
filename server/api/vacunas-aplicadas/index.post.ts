import { sql } from "~/lib/db";
import { optionalDate, optionalText, parseId, runApi } from "~/server/utils/api";
import { requireOwnedBovino, requireOwnedVacuna } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const bovinoId = parseId(body?.bovino_id, "bovino_id");
  const vacunaId = parseId(body?.vacuna_id, "vacuna_id");
  await requireOwnedBovino(bovinoId, userId);
  await requireOwnedVacuna(vacunaId, userId);
  const rows = await sql`
    INSERT INTO vacuna_aplicada
      (bovino_id, vacuna_id, fecha_aplicacion, veterinario, observaciones)
    VALUES (${bovinoId}, ${vacunaId},
      ${optionalDate(body?.fecha_aplicacion, "La fecha de aplicacion") ?? new Date().toISOString().slice(0, 10)},
      ${optionalText(body?.veterinario, 100)}, ${optionalText(body?.observaciones)})
    RETURNING *
  `;
  await rebuildBovinoContext(bovinoId);
  return rows[0];
}));
