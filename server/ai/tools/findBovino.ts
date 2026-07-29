import { sql } from "~/lib/db";

export async function findBovinoByNombre(
  nombre: string,
  usuarioId: number
) {
  const trimmed = nombre.trim();

  const rows = await sql`
    SELECT id, nombre, numero_arete, sexo
    FROM bovinos
    WHERE usuario_id = ${usuarioId}
      AND (
        LOWER(nombre) = LOWER(${trimmed})
        OR LOWER(numero_arete) = LOWER(${trimmed})
      )
    LIMIT 1
  `;

  return rows[0] ?? null;
}
