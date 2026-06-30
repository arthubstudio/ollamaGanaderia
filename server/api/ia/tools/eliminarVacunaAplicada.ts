import postgres from "postgres";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { findBovinoByNombre } from "./findBovino";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

export async function eliminarVacunaAplicada(
  args: { nombre_vaca: string; vacuna_nombre: string },
  usuarioId?: number | null
) {
  if (!usuarioId) return { ok: false as const, error: "Se requiere sesión de usuario." };

  const bovino = await findBovinoByNombre(args.nombre_vaca.trim(), usuarioId);
  if (!bovino?.id) {
    return { ok: false as const, error: `No encontré el bovino "${args.nombre_vaca}".` };
  }

  const rows = await sql`
    DELETE FROM vacuna_aplicada va
    USING vacunas v
    WHERE va.vacuna_id = v.id
      AND va.bovino_id = ${bovino.id}
      AND LOWER(v.nombre) = LOWER(${args.vacuna_nombre.trim()})
    RETURNING va.*
  `;

  if (!rows.length) {
    return {
      ok: false as const,
      error: `No encontré la vacuna "${args.vacuna_nombre}" aplicada a ${bovino.nombre}.`
    };
  }

  await rebuildBovinoContext(bovino.id);
  return { ok: true as const, bovino, vacuna_nombre: args.vacuna_nombre.trim() };
}
