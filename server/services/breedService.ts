import { sql } from "~/lib/db";
import { apiError, optionalText, parseId, requiredText } from "~/server/utils/api";

const BREED_TYPES = new Set(["carne", "leche", "doble_proposito", "trabajo", "otro"]);

function normalizeType(value: unknown) {
  const type = String(value ?? "doble_proposito").trim().toLowerCase();
  if (!BREED_TYPES.has(type)) {
    apiError({ statusCode: 400, code: "INVALID_BREED_TYPE", message: "El tipo de raza no es valido." });
  }
  return type;
}

export async function findBreedByName(name: unknown, includeInactive = false) {
  const text = requiredText(name, "raza", 120);
  const rows = await sql`
    SELECT * FROM breeds
    WHERE LOWER(nombre) = LOWER(${text})
      AND (${includeInactive} OR activo = TRUE)
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listBreeds(input: {
  search?: unknown;
  type?: unknown;
  active?: unknown;
  sort?: unknown;
  limit?: unknown;
  offset?: unknown;
}) {
  const search = optionalText(input.search, 120) ?? "";
  const type = optionalText(input.type, 30);
  const active = input.active == null || input.active === ""
    ? null
    : String(input.active) !== "false";
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 100);
  const offset = Math.max(Number(input.offset) || 0, 0);
  const sort = String(input.sort ?? "nombre");
  const orderBy = sort === "recientes" ? "created_at DESC" : "nombre ASC";

  if (type && !BREED_TYPES.has(type)) {
    apiError({ statusCode: 400, code: "INVALID_BREED_TYPE", message: "El tipo de raza no es valido." });
  }

  const rows = await sql.unsafe(`
    SELECT *, COUNT(*) OVER() AS total
    FROM breeds
    WHERE ($1 = '' OR nombre ILIKE '%' || $1 || '%' OR pais_origen ILIKE '%' || $1 || '%')
      AND ($2::text IS NULL OR tipo = $2)
      AND ($3::boolean IS NULL OR activo = $3)
    ORDER BY ${orderBy}
    LIMIT $4 OFFSET $5
  `, [search, type, active, limit, offset]);

  return {
    items: rows.map((row: any) => ({ ...row, total: undefined })),
    total: Number(rows[0]?.total ?? 0),
    limit,
    offset
  };
}

export async function createBreed(input: {
  userId: number;
  nombre: unknown;
  nombreCientifico?: unknown;
  paisOrigen?: unknown;
  tipo?: unknown;
  descripcion?: unknown;
}) {
  const nombre = requiredText(input.nombre, "nombre", 120);
  const existing = await findBreedByName(nombre, true);
  if (existing) return { created: false, breed: existing };

  const rows = await sql`
    INSERT INTO breeds (
      nombre, nombre_cientifico, pais_origen, tipo,
      descripcion, activo, es_global, created_by
    ) VALUES (
      ${nombre}, ${optionalText(input.nombreCientifico, 160)},
      ${optionalText(input.paisOrigen, 120)}, ${normalizeType(input.tipo)},
      ${optionalText(input.descripcion, 5000)}, TRUE, FALSE, ${input.userId}
    )
    RETURNING *
  `;
  return { created: true, breed: rows[0] };
}

export async function updateBreed(input: {
  userId: number;
  userRole?: string | null;
  id: unknown;
  body: Record<string, unknown>;
}) {
  const id = parseId(input.id, "raza_id");
  const currentRows = await sql`SELECT * FROM breeds WHERE id = ${id} LIMIT 1`;
  const current = currentRows[0];
  if (!current) {
    apiError({ statusCode: 404, code: "NOT_FOUND", message: "Raza no encontrada." });
  }
  if (String(input.userRole ?? "") !== "admin" && Number(current.created_by) !== input.userId) {
    apiError({ statusCode: 403, code: "FORBIDDEN", message: "No tienes permiso para editar esta raza." });
  }

  const rows = await sql`
    UPDATE breeds SET
      nombre = ${input.body.nombre === undefined ? current.nombre : requiredText(input.body.nombre, "nombre", 120)},
      nombre_cientifico = ${input.body.nombre_cientifico === undefined ? current.nombre_cientifico : optionalText(input.body.nombre_cientifico, 160)},
      pais_origen = ${input.body.pais_origen === undefined ? current.pais_origen : optionalText(input.body.pais_origen, 120)},
      tipo = ${input.body.tipo === undefined ? current.tipo : normalizeType(input.body.tipo)},
      descripcion = ${input.body.descripcion === undefined ? current.descripcion : optionalText(input.body.descripcion, 5000)},
      activo = ${input.body.activo === undefined ? current.activo : Boolean(input.body.activo)},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0];
}

