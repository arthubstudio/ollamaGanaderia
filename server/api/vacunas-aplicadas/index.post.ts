import { db } from "~/lib/db";
import { vacunaAplicada } from "~/drizzle/schema";
import { rebuildVacaContext } from "~/lib/rebuildVacaContext";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const result = await db
    .insert(vacunaAplicada)
    .values({
      vaca_id: body.vaca_id,
      vacuna_id: body.vacuna_id,
      fecha_aplicacion: body.fecha_aplicacion,
      veterinario: body.veterinario,
      observaciones: body.observaciones,
    })
    .returning();

  await rebuildVacaContext(body.vaca_id);

  return result[0];
});