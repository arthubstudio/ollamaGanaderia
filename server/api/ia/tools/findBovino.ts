import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

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
