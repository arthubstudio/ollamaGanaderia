import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

export type CrearVacunaArgs = {
  nombre: string;
  descripcion?: string;
};

export async function crearVacuna(
  args: CrearVacunaArgs,
  usuarioId?: number | null
) {
  if (!usuarioId) {
    return { ok: false as const, error: "Se requiere sesión de usuario." };
  }

  if (!args.nombre?.trim()) {
    return { ok: false as const, error: "El nombre de la vacuna es obligatorio." };
  }

  const rows = await sql`
    INSERT INTO vacunas (nombre, descripcion, usuario_id)
    VALUES (
      ${args.nombre.trim()},
      ${args.descripcion?.trim() ?? null},
      ${usuarioId}
    )
    RETURNING *
  `;

  return { ok: true as const, vacuna: rows[0] };
}
