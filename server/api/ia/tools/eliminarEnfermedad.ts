import { db } from "~/lib/db";
import { enfermedades } from "~/drizzle/schema";
import { and, eq, sql as dsql } from "drizzle-orm";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { findBovinoByNombre } from "./findBovino";

export async function eliminarEnfermedad(
  args: { nombre_vaca: string; enfermedad: string },
  usuarioId?: number | null
) {
  if (!usuarioId) return { ok: false as const, error: "Se requiere sesión de usuario." };

  const bovino = await findBovinoByNombre(args.nombre_vaca.trim(), usuarioId);
  if (!bovino?.id) {
    return { ok: false as const, error: `No encontré el bovino "${args.nombre_vaca}".` };
  }

  const deleted = await db
    .delete(enfermedades)
    .where(
      and(
        eq(enfermedades.bovino_id, bovino.id),
        dsql`LOWER(${enfermedades.nombre}) = LOWER(${args.enfermedad.trim()})`
      )
    )
    .returning();

  if (!deleted.length) {
    return {
      ok: false as const,
      error: `No encontré la enfermedad "${args.enfermedad}" en ${bovino.nombre}.`
    };
  }

  await rebuildBovinoContext(bovino.id);
  return { ok: true as const, bovino, eliminada: deleted[0] };
}
