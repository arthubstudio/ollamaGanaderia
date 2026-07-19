import { createBreed } from "~/server/services/breedService";
import { recordActivity } from "~/server/services/activityAudit";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const result = await createBreed({
    userId,
    nombre: body?.nombre,
    nombreCientifico: body?.nombre_cientifico,
    paisOrigen: body?.pais_origen,
    tipo: body?.tipo,
    descripcion: body?.descripcion
  });
  await recordActivity({
    actorUserId: userId,
    action: result.created ? "breed.created" : "breed.reused",
    entityType: "breed",
    entityId: result.breed.id
  });
  return result;
}));

