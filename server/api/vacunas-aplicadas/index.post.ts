import { parseId, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { applyVaccineToBovino } from "~/server/services/vaccination";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const bovinoId = parseId(body?.bovino_id, "bovino_id");
  const vacunaId = parseId(body?.vacuna_id, "vacuna_id");
  const result = await applyVaccineToBovino({
    userId,
    bovinoId,
    vacunaId,
    fechaAplicacion: body?.fecha_aplicacion,
    veterinario: body?.veterinario,
    observaciones: body?.observaciones
  });
  await rebuildBovinoContext(bovinoId);
  return result.aplicacion;
}));
