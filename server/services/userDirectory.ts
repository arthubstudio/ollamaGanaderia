import { sql } from "~/lib/db";
import { requiredText } from "~/server/utils/api";

export type DirectoryUser = {
  id: number;
  nombre: string;
  email: string;
  match_type: "email" | "exact_name" | "partial_name" | "similar_name";
  score: number;
};

export async function searchUsers(query: unknown, currentUserId: number, limit = 10) {
  const text = requiredText(query, "busqueda", 150);
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);

  const rows = await sql`
    SELECT
      id,
      nombre,
      email,
      CASE
        WHEN LOWER(email) = LOWER(${text}) THEN 'email'
        WHEN LOWER(nombre) = LOWER(${text}) THEN 'exact_name'
        WHEN LOWER(nombre) LIKE LOWER(${`%${text}%`}) THEN 'partial_name'
        ELSE 'similar_name'
      END AS match_type,
      CASE
        WHEN LOWER(email) = LOWER(${text}) THEN 1.0
        WHEN LOWER(nombre) = LOWER(${text}) THEN 0.95
        WHEN LOWER(nombre) LIKE LOWER(${`%${text}%`}) THEN 0.8
        ELSE similarity(LOWER(nombre), LOWER(${text}))
      END AS score
    FROM usuarios
    WHERE id <> ${currentUserId}
      AND (
        LOWER(email) = LOWER(${text})
        OR LOWER(nombre) LIKE LOWER(${`%${text}%`})
        OR similarity(LOWER(nombre), LOWER(${text})) >= 0.25
      )
    ORDER BY
      CASE
        WHEN LOWER(email) = LOWER(${text}) THEN 1
        WHEN LOWER(nombre) = LOWER(${text}) THEN 2
        WHEN LOWER(nombre) LIKE LOWER(${`%${text}%`}) THEN 3
        ELSE 4
      END,
      score DESC,
      nombre ASC
    LIMIT ${safeLimit}
  `;

  return rows.map((row: any) => ({
    id: Number(row.id),
    nombre: String(row.nombre),
    email: String(row.email),
    match_type: row.match_type as DirectoryUser["match_type"],
    score: Number(row.score)
  }));
}

function mapExactUser(row: any, matchType: "email" | "exact_name"): DirectoryUser {
  return {
    id: Number(row.id),
    nombre: String(row.nombre),
    email: String(row.email),
    match_type: matchType,
    score: matchType === "email" ? 1 : 0.95
  };
}

export async function resolveExactUser(query: unknown, currentUserId: number, field = "usuario_destino") {
  const text = requiredText(query, field, 150);

  const emailRows = await sql`
    SELECT id, nombre, email
    FROM usuarios
    WHERE LOWER(email) = LOWER(${text})
    LIMIT 2
  `;
  if (emailRows.length) {
    const user = mapExactUser(emailRows[0], "email");
    return user.id === currentUserId
      ? { status: "self" as const, user, matches: [user] }
      : { status: "found" as const, user, matches: [user] };
  }

  const nameRows = await sql`
    SELECT id, nombre, email
    FROM usuarios
    WHERE LOWER(nombre) = LOWER(${text})
    ORDER BY id ASC
    LIMIT 20
  `;
  const matches = nameRows.map((row: any) => mapExactUser(row, "exact_name"));
  if (!matches.length) {
    return { status: "not_found" as const, matches: [] as DirectoryUser[] };
  }
  if (matches.length > 1) {
    return { status: "ambiguous" as const, matches };
  }

  const user = matches[0];
  return user.id === currentUserId
    ? { status: "self" as const, user, matches }
    : { status: "found" as const, user, matches };
}

export const resolveTransferUser = resolveExactUser;

export async function resolveSingleUser(query: unknown, currentUserId: number) {
  const matches = await searchUsers(query, currentUserId, 10);
  const exactEmail = matches.find((item) => item.match_type === "email");
  if (exactEmail) return { status: "found" as const, user: exactEmail, matches };

  const exactNames = matches.filter((item) => item.match_type === "exact_name");
  if (exactNames.length === 1) {
    return { status: "found" as const, user: exactNames[0], matches };
  }

  return matches.length
    ? { status: "ambiguous" as const, matches }
    : { status: "not_found" as const, matches: [] as DirectoryUser[] };
}
