import { sql } from "~/lib/db";
import { apiError } from "~/server/utils/api";

async function requireOwnedRow(
  table: "bovinos" | "duenos" | "ranchos" | "vacunas",
  id: number,
  userId: number,
  label: string
) {
  const rows = await sql.unsafe(
    `SELECT * FROM ${table} WHERE id = $1 AND usuario_id = $2 LIMIT 1`,
    [id, userId]
  );

  if (!rows.length) {
    apiError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: `${label} no encontrado.`
    });
  }

  return rows[0];
}

export const requireOwnedBovino = (id: number, userId: number) =>
  requireOwnedRow("bovinos", id, userId, "Bovino");

export const requireOwnedDueno = (id: number, userId: number) =>
  requireOwnedRow("duenos", id, userId, "Dueno");

export const requireOwnedRancho = (id: number, userId: number) =>
  requireOwnedRow("ranchos", id, userId, "Rancho");

export const requireOwnedVacuna = (id: number, userId: number) =>
  requireOwnedRow("vacunas", id, userId, "Vacuna");
