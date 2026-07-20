import { sql } from "~/lib/db";
import { optionalText, requiredText, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
import { normalizeRelationIds, syncRanchoOwners } from "~/server/services/ownershipRelations";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const duenoIds = normalizeRelationIds(body?.dueno_ids, body?.dueno_id);
  return sql.begin(async (tx) => {
    const rows = await tx`
      INSERT INTO ranchos (usuario_id, nombre, ubicacion, dueno_id)
      VALUES (${userId}, ${requiredText(body?.nombre, "nombre", 100)},
        ${optionalText(body?.ubicacion)}, ${duenoIds[0] ?? null}) RETURNING *
    `;
    await syncRanchoOwners({ client: tx, userId, ranchoId: Number(rows[0].id), duenoIds });
    return { ...rows[0], dueno_ids: duenoIds };
  });
}));
