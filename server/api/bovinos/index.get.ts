import { sql } from "~/lib/db";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  return sql`
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
    WHERE b.usuario_id = ${userId}
    GROUP BY b.id, r.nombre
    ORDER BY b.id DESC
  `;
}));
