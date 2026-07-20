import { sql } from "~/lib/db";
import { apiError, parseId, runApi } from "~/server/utils/api";
import { requireOwnedRancho } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  await requireOwnedRancho(id, userId);
  const rows = await sql`
    SELECT r.*,
      COALESCE(
        JSONB_AGG(JSONB_BUILD_OBJECT('id', d.id, 'nombre', d.nombre) ORDER BY d.nombre)
          FILTER (WHERE d.id IS NOT NULL),
        '[]'::jsonb
      ) AS duenos
    FROM ranchos r
    LEFT JOIN rancho_duenos rd ON rd.rancho_id = r.id
    LEFT JOIN duenos d ON d.id = rd.dueno_id AND d.usuario_id = ${userId}
    WHERE r.id = ${id} AND r.usuario_id = ${userId}
    GROUP BY r.id
  `;
  if (!rows.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Rancho no encontrado." });
  return rows[0];
}));
