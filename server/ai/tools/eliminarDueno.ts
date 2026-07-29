import { sql } from "~/lib/db";

export async function eliminarDueno(
  args: { nombre: string },
  usuarioId?: number | null
) {
  if (!usuarioId) return { ok: false as const, error: "Se requiere sesión de usuario." };

  const rows = await sql`
    DELETE FROM duenos
    WHERE usuario_id = ${usuarioId}
      AND LOWER(nombre) = LOWER(${args.nombre.trim()})
    RETURNING *
  `;

  if (!rows.length) {
    return { ok: false as const, error: `No encontré el dueño "${args.nombre}".` };
  }

  return { ok: true as const, dueno: rows[0] };
}
