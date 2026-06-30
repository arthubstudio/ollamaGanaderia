import postgres from "postgres";
import { findBovinoByNombre } from "./findBovino";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

export async function eliminarBovino(
  args: { nombre: string },
  usuarioId?: number | null
) {
  if (!usuarioId) return { ok: false as const, error: "Se requiere sesión de usuario." };
  if (!args.nombre?.trim()) return { ok: false as const, error: "Indica el nombre del bovino." };

  const bovino = await findBovinoByNombre(args.nombre.trim(), usuarioId);
  if (!bovino?.id) {
    return { ok: false as const, error: `No encontré el bovino "${args.nombre}" en tu cuenta.` };
  }

  const id = Number(bovino.id);

  await sql.begin(async (tx) => {
    await tx`DELETE FROM semantic_contexts WHERE bovino_id = ${id}`;
    await tx`DELETE FROM vacuna_aplicada WHERE bovino_id = ${id}`;
    await tx`DELETE FROM pesos WHERE bovino_id = ${id}`;
    await tx`DELETE FROM enfermedades WHERE bovino_id = ${id}`;
    await tx`DELETE FROM ventas WHERE bovino_id = ${id}`;
    await tx`DELETE FROM historial_propiedad WHERE bovino_id = ${id}`;
    await tx`DELETE FROM bovinos WHERE id = ${id}`;
  });

  return { ok: true as const, bovino };
}
