import { sql } from "~/lib/db";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  return sql`
    SELECT r.*,
      COALESCE(
        JSONB_AGG(JSONB_BUILD_OBJECT('id', d.id, 'nombre', d.nombre) ORDER BY d.nombre)
          FILTER (WHERE d.id IS NOT NULL),
        '[]'::jsonb
      ) AS duenos
    FROM ranchos r
    LEFT JOIN rancho_duenos rd ON rd.rancho_id = r.id
    LEFT JOIN duenos d ON d.id = rd.dueno_id AND d.usuario_id = ${userId}
    WHERE r.usuario_id = ${userId}
    GROUP BY r.id
    ORDER BY r.nombre ASC
  `;
}));
