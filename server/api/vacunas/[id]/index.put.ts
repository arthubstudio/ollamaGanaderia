import { db } from "~/lib/db";
import { vacunas } from "~/drizzle/schema";
import { eq } from "drizzle-orm";
import { findVacunaByNombreUsuario, mensajeVacunaYaExiste } from "~/lib/vacunaService";

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id);
  const body = await readBody(event);
  const nombre = String(body.nombre ?? "").trim();

  if (!nombre) {
    throw createError({
      statusCode: 400,
      statusMessage: "El nombre de la vacuna es obligatorio."
    });
  }

  const actual = await db
    .select()
    .from(vacunas)
    .where(eq(vacunas.id, id))
    .limit(1);

  const vacunaActual = actual[0];
  if (!vacunaActual?.usuario_id) {
    throw createError({
      statusCode: 404,
      statusMessage: "Vacuna no encontrada."
    });
  }

  const duplicada = await findVacunaByNombreUsuario(
    nombre,
    vacunaActual.usuario_id,
    id
  );

  if (duplicada) {
    throw createError({
      statusCode: 409,
      statusMessage: mensajeVacunaYaExiste(nombre)
    });
  }

  try {
    const result = await db
      .update(vacunas)
      .set({
        nombre,
        descripcion: body.descripcion ?? null
      })
      .where(eq(vacunas.id, id))
      .returning();

    return result[0];
  } catch (error: any) {
    if (error?.code === "23505") {
      throw createError({
        statusCode: 409,
        statusMessage: mensajeVacunaYaExiste(nombre)
      });
    }

    throw error;
  }
});
