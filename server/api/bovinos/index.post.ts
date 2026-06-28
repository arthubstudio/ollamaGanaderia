import { db } from "~/lib/db";
import { bovinos } from "~/drizzle/schema";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { validarDatosBovino } from "~/lib/bovinoValidation";

export default defineEventHandler(async (event) => {

  const body =
    await readBody(event);

  const validacion = validarDatosBovino({
    numero_arete: String(body.numero_arete ?? ""),
    nombre: String(body.nombre ?? ""),
    raza: String(body.raza ?? ""),
    sexo: String(body.sexo ?? "")
  });

  if (!validacion.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: validacion.error
    });
  }

  const result =
    await db
      .insert(bovinos)
      .values({

        usuario_id:
          body.usuario_id,

        numero_arete:
          validacion.datos.numero_arete,

        nombre:
          validacion.datos.nombre,

        raza:
          validacion.datos.raza,

        sexo:
          validacion.datos.sexo,

        fecha_nacimiento:
          body.fecha_nacimiento,

        estado:
          body.estado ?? "activa"

      })
      .returning();

  const vaca =
    result[0];

  try {

  await rebuildBovinoContext(vaca.id);

  } catch (error) {

    console.error("No se pudo reconstruir el contexto IA:", error);

  }

  return vaca;

});