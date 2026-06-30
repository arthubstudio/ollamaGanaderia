import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

export async function crearRancho(
  args: { nombre: string; ubicacion?: string; dueno_nombre?: string },
  usuarioId?: number | null
) {
  if (!usuarioId) return { ok: false as const, error: "Se requiere sesión de usuario." };
  if (!args.nombre?.trim()) return { ok: false as const, error: "Indica el nombre del rancho." };

  const existente = await sql`
    SELECT id, nombre FROM ranchos
    WHERE usuario_id = ${usuarioId} AND LOWER(nombre) = LOWER(${args.nombre.trim()})
    LIMIT 1
  `;

  if (existente.length) {
    return {
      ok: true as const,
      rancho: existente[0],
      creado: false
    };
  }

  let duenoId: number | null = null;
  if (args.dueno_nombre?.trim()) {
    const dueno = await sql`
      SELECT id FROM duenos
      WHERE usuario_id = ${usuarioId} AND LOWER(nombre) = LOWER(${args.dueno_nombre.trim()})
      LIMIT 1
    `;
    duenoId = dueno[0]?.id ? Number(dueno[0].id) : null;
  }

  const rows = await sql`
    INSERT INTO ranchos (nombre, ubicacion, dueno_id, usuario_id)
    VALUES (
      ${args.nombre.trim()},
      ${args.ubicacion?.trim() ?? null},
      ${duenoId},
      ${usuarioId}
    )
    RETURNING *
  `;

  return { ok: true as const, rancho: rows[0], creado: true };
}
