import { sql } from "~/lib/db";

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
