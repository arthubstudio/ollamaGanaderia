import { sql } from "~/lib/db";
import { optionalId, requiredDate } from "~/server/utils/api";
import {
  requireOwnedBovino,
  requireOwnedDueno,
  requireOwnedRancho
} from "~/server/utils/ownership";

export async function transferOwnership(input: {
  userId: number;
  bovinoId: number;
  duenoId?: unknown;
  ranchoId?: unknown;
  fechaInicio: unknown;
  observaciones?: string | null;
}) {
  await requireOwnedBovino(input.bovinoId, input.userId);
  const duenoId = optionalId(input.duenoId, "dueno_id");
  const ranchoId = optionalId(input.ranchoId, "rancho_id");
  if (duenoId) await requireOwnedDueno(duenoId, input.userId);
  if (ranchoId) await requireOwnedRancho(ranchoId, input.userId);
  const fecha = requiredDate(input.fechaInicio, "La fecha de inicio");

  return sql.begin(async (tx) => {
    await tx`
      UPDATE historial_propiedad
      SET fecha_fin = ${fecha}
      WHERE bovino_id = ${input.bovinoId} AND fecha_fin IS NULL
    `;
    const rows = await tx`
      INSERT INTO historial_propiedad
        (bovino_id, dueno_id, rancho_id, fecha_inicio, fecha_fin, observaciones)
      VALUES
        (${input.bovinoId}, ${duenoId}, ${ranchoId}, ${fecha}, NULL, ${input.observaciones ?? null})
      RETURNING *
    `;
    return rows[0];
  });
}
