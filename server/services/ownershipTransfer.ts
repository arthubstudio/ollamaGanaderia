import { sql } from "~/lib/db";
import { optionalId, requiredDate } from "~/server/utils/api";
import {
  requireOwnedBovino,
  requireOwnedRancho
} from "~/server/utils/ownership";
import {
  getRanchoOwnerIds,
  normalizeRelationIds,
  requireOwnedRelationIds,
  syncBovinoOwners
} from "~/server/services/ownershipRelations";

export async function transferOwnership(input: {
  userId: number;
  bovinoId: number;
  duenoId?: unknown;
  duenoIds?: unknown;
  ranchoId?: unknown;
  fechaInicio: unknown;
  observaciones?: string | null;
}) {
  await requireOwnedBovino(input.bovinoId, input.userId);
  const duenoId = optionalId(input.duenoId, "dueno_id");
  const ranchoId = optionalId(input.ranchoId, "rancho_id");
  if (ranchoId) await requireOwnedRancho(ranchoId, input.userId);
  const fecha = requiredDate(input.fechaInicio, "La fecha de inicio");

  return sql.begin(async (tx) => {
    const explicitOwnerIds = normalizeRelationIds(input.duenoIds, duenoId);
    await requireOwnedRelationIds(tx, input.userId, explicitOwnerIds);
    const ownerIds = explicitOwnerIds.length
      ? explicitOwnerIds
      : await getRanchoOwnerIds(tx, ranchoId);
    await tx`
      UPDATE historial_propiedad
      SET fecha_fin = ${fecha}
      WHERE bovino_id = ${input.bovinoId} AND fecha_fin IS NULL
    `;
    const rows = await tx`
      INSERT INTO historial_propiedad
        (bovino_id, dueno_id, rancho_id, fecha_inicio, fecha_fin, observaciones)
      VALUES
        (${input.bovinoId}, ${ownerIds[0] ?? null}, ${ranchoId}, ${fecha}, NULL, ${input.observaciones ?? null})
      RETURNING *
    `;
    await tx`
      UPDATE bovinos SET rancho_id = ${ranchoId}, updated_at = NOW()
      WHERE id = ${input.bovinoId} AND usuario_id = ${input.userId}
    `;
    await syncBovinoOwners({
      client: tx,
      userId: input.userId,
      bovinoId: input.bovinoId,
      duenoIds: ownerIds
    });
    return { ...rows[0], dueno_ids: ownerIds };
  });
}
