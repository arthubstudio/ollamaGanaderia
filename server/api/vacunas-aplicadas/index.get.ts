import { db } from "~/lib/db";
import { bovinos, vacunaAplicada, vacunas } from "~/drizzle/schema";
import { and, desc, eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const vacaId = Number(query.bovino_id);
  const usuarioId = Number(query.usuario_id);

  if (!vacaId || !usuarioId) {
    return [];
  }

  const vaca = await db
    .select({ id: bovinos.id })
    .from(bovinos)
    .where(
      and(
        eq(bovinos.id, vacaId),
        eq(bovinos.usuario_id, usuarioId)
      )
    );

  if (!vaca.length) {
    return [];
  }

  return await db
    .select({
      id: vacunaAplicada.id,
      bovino_id: vacunaAplicada.bovino_id,
      vacuna_id: vacunaAplicada.vacuna_id,
      fecha_aplicacion: vacunaAplicada.fecha_aplicacion,
      veterinario: vacunaAplicada.veterinario,
      observaciones: vacunaAplicada.observaciones,
      vacuna_nombre: vacunas.nombre,
    })
    .from(vacunaAplicada)
    .leftJoin(vacunas, eq(vacunaAplicada.vacuna_id, vacunas.id))
    .where(eq(vacunaAplicada.bovino_id, vacaId))
    .orderBy(desc(vacunaAplicada.fecha_aplicacion), desc(vacunaAplicada.id));
});