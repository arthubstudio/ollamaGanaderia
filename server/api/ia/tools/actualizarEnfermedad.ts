import { db } from "~/lib/db";
import { enfermedades } from "~/drizzle/schema";
import { and, eq, sql as dsql } from "drizzle-orm";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { findBovinoByNombre } from "./findBovino";

export async function actualizarEnfermedad(
  args: {
    nombre_vaca: string;
    enfermedad: string;
    nuevo_nombre?: string;
    tratamiento?: string;
    veterinario?: string;
  },
  usuarioId?: number | null
) {
  if (!usuarioId) return { ok: false as const, error: "Se requiere sesión de usuario." };

  const bovino = await findBovinoByNombre(args.nombre_vaca.trim(), usuarioId);
  if (!bovino?.id) {
    return { ok: false as const, error: `No encontré el bovino "${args.nombre_vaca}".` };
  }

  const cambios: Record<string, string | null> = {};
  if (args.nuevo_nombre?.trim()) cambios.nombre = args.nuevo_nombre.trim();
  if (args.tratamiento !== undefined) cambios.tratamiento = args.tratamiento?.trim() ?? null;
  if (args.veterinario !== undefined) cambios.veterinario = args.veterinario?.trim() ?? null;

  if (!Object.keys(cambios).length) {
    return { ok: false as const, error: "Indica qué deseas actualizar de la enfermedad." };
  }

  const updated = await db
    .update(enfermedades)
    .set(cambios)
    .where(
      and(
        eq(enfermedades.bovino_id, bovino.id),
        dsql`LOWER(${enfermedades.nombre}) = LOWER(${args.enfermedad.trim()})`
      )
    )
    .returning();

  if (!updated.length) {
    return {
      ok: false as const,
      error: `No encontré la enfermedad "${args.enfermedad}" en ${bovino.nombre}.`
    };
  }

  await rebuildBovinoContext(bovino.id);
  return { ok: true as const, bovino, registro: updated[0] };
}
