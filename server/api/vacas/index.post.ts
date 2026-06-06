import { db } from "~/lib/db";
import { vacas } from "~/drizzle/schema";
import { rebuildVacaContext } from "~/lib/rebuildVacaContext";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const result = await db
    .insert(vacas)
    .values({
      numero_arete: body.numero_arete,
      nombre: body.nombre,
      raza: body.raza,
      sexo: body.sexo,
      fecha_nacimiento: body.fecha_nacimiento,
      estado: body.estado ?? "activa",
    })
    .returning();

  const vaca = result[0];
  
  // ingestion pipeline
  await rebuildVacaContext(vaca.id);

  return vaca;
});