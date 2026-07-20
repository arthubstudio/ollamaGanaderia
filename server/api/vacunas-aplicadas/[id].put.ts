import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { parseId, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
import { updateVaccineApplication } from "~/server/services/vaccination";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const body = await readBody(event);
  const result = await updateVaccineApplication({
    userId,
    applicationId: id,
    vacunaId: body?.vacuna_id,
    fechaAplicacion: body?.fecha_aplicacion,
    veterinario: body?.veterinario,
    observaciones: body?.observaciones
  });
  await rebuildBovinoContext(Number(result.bovino_id));
  return result;
}));
