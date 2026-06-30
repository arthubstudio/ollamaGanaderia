import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

export async function eliminarVacuna(
  args: { nombre: string },
  usuarioId?: number | null
) {
  if (!usuarioId) return { ok: false as const, error: "Se requiere sesión de usuario." };

  const rows = await sql`
    DELETE FROM vacunas
    WHERE usuario_id = ${usuarioId}
      AND LOWER(nombre) = LOWER(${args.nombre.trim()})
    RETURNING *
  `;

  if (!rows.length) {
    return { ok: false as const, error: `No encontré la vacuna "${args.nombre}" en tu catálogo.` };
  }

  return { ok: true as const, vacuna: rows[0] };
}
