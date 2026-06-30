import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

export async function crearDueno(
  args: { nombre: string; telefono?: string; direccion?: string },
  usuarioId?: number | null
) {
  if (!usuarioId) return { ok: false as const, error: "Se requiere sesión de usuario." };
  if (!args.nombre?.trim()) return { ok: false as const, error: "Indica el nombre del dueño." };

  const existente = await sql`
    SELECT id, nombre FROM duenos
    WHERE usuario_id = ${usuarioId} AND LOWER(nombre) = LOWER(${args.nombre.trim()})
    LIMIT 1
  `;

  if (existente.length) {
    return {
      ok: true as const,
      dueno: existente[0],
      creado: false
    };
  }

  const rows = await sql`
    INSERT INTO duenos (nombre, telefono, direccion, usuario_id)
    VALUES (
      ${args.nombre.trim()},
      ${args.telefono?.trim() ?? null},
      ${args.direccion?.trim() ?? null},
      ${usuarioId}
    )
    RETURNING *
  `;

  return { ok: true as const, dueno: rows[0], creado: true };
}
