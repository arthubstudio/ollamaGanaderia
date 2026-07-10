import { sql } from "~/lib/db";
import { optionalDate, optionalText, parseId, requiredText, runApi } from "~/server/utils/api";
import { requireOwnedBovino } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const bovinoId = parseId(body?.bovino_id, "bovino_id");
  await requireOwnedBovino(bovinoId, userId);
  const rows = await sql`
    INSERT INTO enfermedades (bovino_id, nombre, tratamiento, fecha, veterinario)
    VALUES (${bovinoId}, ${requiredText(body?.nombre, "nombre", 100)},
      ${optionalText(body?.tratamiento)},
      ${optionalDate(body?.fecha, "La fecha") ?? new Date().toISOString().slice(0, 10)},
      ${optionalText(body?.veterinario, 100)}) RETURNING *
  `;
  await rebuildBovinoContext(bovinoId);
  return rows[0];
}));
