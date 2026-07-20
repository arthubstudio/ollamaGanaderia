import { sql } from "~/lib/db";
import { optionalText, parseId, requiredText, runApi } from "~/server/utils/api";
import { requireOwnedRancho } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
import { normalizeRelationIds, syncRanchoOwners } from "~/server/services/ownershipRelations";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const body = await readBody(event);
  await requireOwnedRancho(id, userId);
  const duenoIds = normalizeRelationIds(body?.dueno_ids, body?.dueno_id);
  return sql.begin(async (tx) => {
    const rows = await tx`
      UPDATE ranchos SET nombre = ${requiredText(body?.nombre, "nombre", 100)},
        ubicacion = ${optionalText(body?.ubicacion)}, dueno_id = ${duenoIds[0] ?? null}
      WHERE id = ${id} AND usuario_id = ${userId} RETURNING *
    `;
    await syncRanchoOwners({ client: tx, userId, ranchoId: id, duenoIds });
    return { ...rows[0], dueno_ids: duenoIds };
  });
}));
