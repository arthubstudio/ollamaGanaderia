import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { optionalText, parseId, runApi } from "~/server/utils/api";
import { transferOwnership } from "~/server/services/ownershipTransfer";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const bovinoId = parseId(body?.bovino_id, "bovino_id");
  const result = await transferOwnership({
    userId, bovinoId, duenoId: body?.dueno_id, duenoIds: body?.dueno_ids, ranchoId: body?.rancho_id,
    fechaInicio: body?.fecha_inicio,
    observaciones: optionalText(body?.observaciones)
  });
  await rebuildBovinoContext(bovinoId);
  return result;
}));
