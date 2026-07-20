import { sql } from "~/lib/db";
import { apiError, parseId, runApi } from "~/server/utils/api";
import { requireOwnedBovino } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  await requireOwnedBovino(id, userId);
  const rows = await sql`
    SELECT b.*, r.nombre AS rancho_nombre,
      COALESCE(
        JSONB_AGG(JSONB_BUILD_OBJECT('id', d.id, 'nombre', d.nombre) ORDER BY d.nombre)
          FILTER (WHERE d.id IS NOT NULL),
        '[]'::jsonb
      ) AS duenos
    FROM bovinos b
    LEFT JOIN ranchos r ON r.id = b.rancho_id AND r.usuario_id = ${userId}
    LEFT JOIN bovino_duenos bd ON bd.bovino_id = b.id
    LEFT JOIN duenos d ON d.id = bd.dueno_id AND d.usuario_id = ${userId}
    WHERE b.id = ${id} AND b.usuario_id = ${userId}
    GROUP BY b.id, r.nombre
  `;
  if (!rows.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Bovino no encontrado." });
  return rows[0];
}));
