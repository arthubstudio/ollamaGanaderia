import { db } from "~/lib/db";
import { enfermedades } from "~/drizzle/schema";
import { rebuildVacaContext } from "~/lib/rebuildVacaContext";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const result = await db
    .insert(enfermedades)
    .values({
      vaca_id: body.vaca_id,
      nombre: body.nombre,
      tratamiento: body.tratamiento,
      fecha: body.fecha,
      veterinario: body.veterinario,
    })
    .returning();

  await rebuildVacaContext(body.vaca_id);

  return result[0];
});