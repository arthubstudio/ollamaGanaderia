import { apiError } from "~/server/utils/api";

export function normalizeRelationIds(value: unknown, singularValue?: unknown) {
  const values = Array.isArray(value)
    ? value
    : value === undefined || value === null || value === ""
      ? (singularValue === undefined || singularValue === null || singularValue === "" ? [] : [singularValue])
      : [value];
  const ids = [...new Set(values.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    apiError({ statusCode: 400, code: "INVALID_OWNER_IDS", message: "Uno de los IDs de dueno no es valido." });
  }
  return ids;
}

export async function requireOwnedRelationIds(client: any, userId: number, duenoIds: number[]) {
  if (!duenoIds.length) return;
  const rows = await client`
    SELECT id FROM duenos
    WHERE usuario_id = ${userId} AND id = ANY(${duenoIds}::int[])
  `;
  if (rows.length !== duenoIds.length) {
    apiError({
      statusCode: 404,
      code: "OWNER_RELATION_NOT_FOUND",
      message: "Uno o mas duenos no existen en tu cuenta."
    });
  }
}

export async function requireOwnedActiveRancho(client: any, userId: number, ranchoId: number | null) {
  if (!ranchoId) return null;
  const rows = await client`
    SELECT * FROM ranchos WHERE id = ${ranchoId} AND usuario_id = ${userId} LIMIT 1
  `;
  if (!rows.length) {
    apiError({ statusCode: 404, code: "RANCHO_NOT_FOUND", message: "Rancho no encontrado en tu cuenta." });
  }
  return rows[0];
}

export async function getRanchoOwnerIds(client: any, ranchoId: number | null) {
  if (!ranchoId) return [] as number[];
  const rows = await client`
    SELECT dueno_id FROM rancho_duenos WHERE rancho_id = ${ranchoId} ORDER BY dueno_id
  `;
  return rows.map((row: any) => Number(row.dueno_id));
}

export async function syncRanchoOwners(input: {
  client: any;
  userId: number;
  ranchoId: number;
  duenoIds: number[];
}) {
  await requireOwnedRelationIds(input.client, input.userId, input.duenoIds);
  await input.client`DELETE FROM rancho_duenos WHERE rancho_id = ${input.ranchoId}`;
  for (const duenoId of input.duenoIds) {
    await input.client`
      INSERT INTO rancho_duenos (rancho_id, dueno_id, created_by_user_id)
      VALUES (${input.ranchoId}, ${duenoId}, ${input.userId})
      ON CONFLICT (rancho_id, dueno_id) DO NOTHING
    `;
  }
  await input.client`
    UPDATE ranchos SET dueno_id = ${input.duenoIds[0] ?? null}
    WHERE id = ${input.ranchoId} AND usuario_id = ${input.userId}
  `;
}

export async function syncBovinoOwners(input: {
  client: any;
  userId: number;
  bovinoId: number;
  duenoIds: number[];
}) {
  await requireOwnedRelationIds(input.client, input.userId, input.duenoIds);
  await input.client`DELETE FROM bovino_duenos WHERE bovino_id = ${input.bovinoId}`;
  for (const duenoId of input.duenoIds) {
    await input.client`
      INSERT INTO bovino_duenos (bovino_id, dueno_id, created_by_user_id)
      VALUES (${input.bovinoId}, ${duenoId}, ${input.userId})
      ON CONFLICT (bovino_id, dueno_id) DO NOTHING
    `;
  }
}
