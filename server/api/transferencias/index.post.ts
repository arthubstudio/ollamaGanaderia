import { db } from "~/lib/db";

import {
  historialPropiedad
} from "~/drizzle/schema";

export default defineEventHandler(async (event) => {

  const body = await readBody(event);

  const result = await db
    .insert(historialPropiedad)
    .values({

      bovino_id: body.bovino_id,

      dueno_id: body.dueno_id,

      rancho_id: body.rancho_id,

      fecha_inicio: body.fecha_inicio,

      fecha_fin: null,

      observaciones: body.observaciones

    })
    .returning();

  return result[0];

});