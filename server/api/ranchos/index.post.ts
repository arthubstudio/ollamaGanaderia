import { db } from "~/lib/db";
import { ranchos } from "~/drizzle/schema";

export default defineEventHandler(async (event) => {

  const body = await readBody(event);

  const result = await db
    .insert(ranchos)
    .values({
      nombre: body.nombre,
      ubicacion: body.ubicacion,
      dueno_id: body.dueno_id
    })
    .returning();

  return result[0];

});