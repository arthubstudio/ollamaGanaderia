import { sql } from "~/lib/db";
import { apiError, requiredText } from "~/server/utils/api";

export type DirectoryUser = {
  id: number;
  nombre: string;
  email: string;
  recipient_key: string;
  match_type: "email" | "exact_name" | "partial_name" | "similar_name" | "directory_key";
  score: number;
};

export function maskEmail(value: unknown) {
  const email = String(value ?? "").trim();
  const [local, domain] = email.split("@");
  if (!local || !domain) return "correo protegido";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, Math.min(8, local.length - visible.length)))}@${domain}`;
}

function mapDirectoryUser(row: any, matchType?: DirectoryUser["match_type"]): DirectoryUser {
  return {
    id: Number(row.id),
    nombre: String(row.nombre),
    email: maskEmail(row.email),
    recipient_key: `key:${String(row.directory_key)}`,
    match_type: matchType ?? row.match_type,
    score: Number(row.score ?? (matchType === "email" ? 1 : 0.95))
  };
}

export async function searchUsers(query: unknown, currentUserId: number, limit = 8) {
  const text = requiredText(query, "busqueda", 150);
  const isEmail = /^\S+@\S+\.\S+$/.test(text);
  if (!isEmail && text.length < 3) {
    apiError({
      statusCode: 400,
      code: "SEARCH_TOO_SHORT",
      message: "Escribe al menos 3 caracteres para buscar usuarios."
    });
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 8);

  const rows = await sql`
    SELECT
      id,
      nombre,
      email,
      directory_key,
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
        OR similarity(LOWER(nombre), LOWER(${text})) >= 0.35
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

  return rows.map((row: any) => mapDirectoryUser(row));
}

export async function resolveExactUser(
  query: unknown,
  currentUserId: number,
  field = "usuario_destino"
) {
  const text = requiredText(query, field, 180);
  const keyMatch = text.match(/^key:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);

  if (keyMatch?.[1]) {
    const keyRows = await sql`
      SELECT id, nombre, email, directory_key
      FROM usuarios
      WHERE directory_key = ${keyMatch[1]}::uuid
      LIMIT 1
    `;
    if (keyRows[0]) {
      const user = mapDirectoryUser(keyRows[0], "directory_key");
      return user.id === currentUserId
        ? { status: "self" as const, user, matches: [user] }
        : { status: "found" as const, user, matches: [user] };
    }
  }

  const emailRows = await sql`
    SELECT id, nombre, email, directory_key
    FROM usuarios
    WHERE LOWER(email) = LOWER(${text})
    LIMIT 1
  `;
  if (emailRows[0]) {
    const user = mapDirectoryUser(emailRows[0], "email");
    return user.id === currentUserId
      ? { status: "self" as const, user, matches: [user] }
      : { status: "found" as const, user, matches: [user] };
  }

  const nameRows = await sql`
    SELECT id, nombre, email, directory_key
    FROM usuarios
    WHERE LOWER(nombre) = LOWER(${text})
    ORDER BY id ASC
    LIMIT 9
  `;
  const matches = nameRows.map((row: any) => mapDirectoryUser(row, "exact_name"));
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
  const exact = await resolveExactUser(query, currentUserId);
  if (exact.status !== "not_found") return exact;

  const matches = await searchUsers(query, currentUserId, 8);
  const exactNames = matches.filter((item) => item.match_type === "exact_name");
  if (exactNames.length === 1) {
    return { status: "found" as const, user: exactNames[0], matches };
  }

  return matches.length
    ? { status: "ambiguous" as const, matches }
    : { status: "not_found" as const, matches: [] as DirectoryUser[] };
}
