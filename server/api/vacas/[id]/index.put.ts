import { db } from "~/lib/db";
import { vacas } from "~/drizzle/schema";
import { eq } from "drizzle-orm";
import { rebuildVacaContext } from "~/lib/rebuildVacaContext";

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id);
  const body = await readBody(event);

  const result = await db
    .update(vacas)
    .set({
      numero_arete: body.numero_arete,
      nombre: body.nombre,
      raza: body.raza,
      sexo: body.sexo,
      fecha_nacimiento: body.fecha_nacimiento,
      estado: body.estado ?? "activa",
      updated_at: new Date(),
    })
    .where(eq(vacas.id, id))
    .returning();

  await rebuildVacaContext(id);

  return result[0];
});