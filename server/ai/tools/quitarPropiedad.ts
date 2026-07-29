import { sql } from "~/lib/db";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { findBovinoByNombre } from "./findBovino";

export async function quitarPropiedad(
  args: {
    nombre_vaca: string;
    quitar_rancho?: boolean;
    quitar_dueno?: boolean;
  },
  usuarioId?: number | null
) {
  if (!usuarioId) return { ok: false as const, error: "Se requiere sesión de usuario." };

  const bovino = await findBovinoByNombre(args.nombre_vaca.trim(), usuarioId);
  if (!bovino?.id) {
    return { ok: false as const, error: `No encontré el bovino "${args.nombre_vaca}".` };
  }

  const actual = await sql`
    SELECT id, dueno_id, rancho_id
    FROM historial_propiedad
    WHERE bovino_id = ${bovino.id}
      AND fecha_fin IS NULL
    ORDER BY fecha_inicio DESC
    LIMIT 1
  `;

  if (!actual.length) {
    return { ok: false as const, error: `${bovino.nombre} no tiene propiedad asignada actualmente.` };
  }

  const row = actual[0];
  const quitarRancho = args.quitar_rancho !== false;
  const quitarDueno = args.quitar_dueno !== false;

  const nuevoDuenoId = quitarDueno ? null : row.dueno_id;
  const nuevoRanchoId = quitarRancho ? null : row.rancho_id;

  if (nuevoDuenoId === row.dueno_id && nuevoRanchoId === row.rancho_id) {
    return { ok: false as const, error: "Indica si deseas quitar el dueño, el rancho o ambos." };
  }

  await sql.begin(async (tx) => {
    if (nuevoDuenoId === null && nuevoRanchoId === null) {
      await tx`
        UPDATE historial_propiedad
        SET fecha_fin = CURRENT_DATE
        WHERE id = ${row.id}
      `;
    } else {
      await tx`
        UPDATE historial_propiedad
        SET dueno_id = ${nuevoDuenoId}, rancho_id = ${nuevoRanchoId}
        WHERE id = ${row.id}
      `;
    }
    if (quitarDueno) {
      await tx`DELETE FROM bovino_duenos WHERE bovino_id = ${bovino.id}`;
    }
    if (quitarRancho) {
      await tx`
        UPDATE bovinos SET rancho_id = NULL, updated_at = NOW()
        WHERE id = ${bovino.id} AND usuario_id = ${usuarioId}
      `;
    }
  });

  await rebuildBovinoContext(bovino.id);

  return {
    ok: true as const,
    bovino,
    quito_rancho: quitarRancho && row.rancho_id != null,
    quito_dueno: quitarDueno && row.dueno_id != null
  };
}
