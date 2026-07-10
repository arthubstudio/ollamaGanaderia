import { sql } from "~/lib/db";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const [bovinos, vacunas, pesos] = await Promise.all([
    sql`SELECT COUNT(*) AS total FROM bovinos WHERE usuario_id = ${userId}`,
    sql`SELECT COUNT(*) AS total FROM vacuna_aplicada va JOIN bovinos b ON b.id = va.bovino_id WHERE b.usuario_id = ${userId}`,
    sql`SELECT ROUND(AVG(p.peso)::numeric, 2) AS promedio FROM pesos p JOIN bovinos b ON b.id = p.bovino_id WHERE b.usuario_id = ${userId}`
  ]);
  return {
    totalBovinos: Number(bovinos[0].total),
    vacunasAplicadas: Number(vacunas[0].total),
    pesoPromedio: Number(pesos[0].promedio ?? 0)
  };
}));
