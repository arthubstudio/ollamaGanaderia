import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

export function normalizeVacunaNombre(nombre: string) {
  return (nombre ?? "").trim();
}

export async function findVacunaByNombreUsuario(
  nombre: string,
  usuarioId: number,
  excludeId?: number
) {
  const nombreNorm = normalizeVacunaNombre(nombre);
  if (!nombreNorm) return null;

  const rows = excludeId
    ? await sql`
        SELECT id, nombre, descripcion, usuario_id
        FROM vacunas
        WHERE usuario_id = ${usuarioId}
          AND LOWER(nombre) = LOWER(${nombreNorm})
          AND id <> ${excludeId}
        LIMIT 1
      `
    : await sql`
        SELECT id, nombre, descripcion, usuario_id
        FROM vacunas
        WHERE usuario_id = ${usuarioId}
          AND LOWER(nombre) = LOWER(${nombreNorm})
        LIMIT 1
      `;

  return rows[0] ?? null;
}

export function mensajeVacunaYaExiste(nombre: string) {
  return `La vacuna "${normalizeVacunaNombre(nombre)}" ya existe.`;
}

export type CrearVacunaInput = {
  nombre: string;
  descripcion?: string | null;
  usuarioId: number;
};

export type CrearVacunaResult =
  | { ok: true; vacuna: Record<string, unknown> }
  | { ok: false; error: string; code: "DUPLICATE" | "VALIDATION" };

export async function crearVacunaUsuario(
  input: CrearVacunaInput
): Promise<CrearVacunaResult> {
  const nombre = normalizeVacunaNombre(input.nombre);

  if (!input.usuarioId) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Se requiere sesión de usuario."
    };
  }

  if (!nombre) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "El nombre de la vacuna es obligatorio."
    };
  }

  const existente = await findVacunaByNombreUsuario(nombre, input.usuarioId);
  if (existente) {
    return {
      ok: false,
      code: "DUPLICATE",
      error: mensajeVacunaYaExiste(nombre)
    };
  }

  try {
    const rows = await sql`
      INSERT INTO vacunas (nombre, descripcion, usuario_id)
      VALUES (
        ${nombre},
        ${input.descripcion?.trim() || null},
        ${input.usuarioId}
      )
      RETURNING *
    `;

    return { ok: true, vacuna: rows[0] };
  } catch (error: any) {
    if (error?.code === "23505") {
      return {
        ok: false,
        code: "DUPLICATE",
        error: mensajeVacunaYaExiste(nombre)
      };
    }

    throw error;
  }
}
