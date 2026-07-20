import { sql } from "~/lib/db";
import { evaluateVentaReadiness } from "~/lib/ventaReadiness.js";
import { requiredText, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const nombre = requiredText(body?.nombre, "nombre", 100);
  const rows = await sql`
    SELECT id, nombre FROM bovinos
    WHERE usuario_id = ${userId} AND LOWER(nombre) = LOWER(${nombre})
    LIMIT 1
  `;
  if (!rows.length) {
    const answer = "No encontre ese bovino en tu cuenta.";
    return { lista: false, answer, respuesta: answer };
  }

  const bovino = rows[0];
  const [pesos, vacunas] = await Promise.all([
    sql`
      SELECT peso FROM pesos WHERE bovino_id = ${bovino.id}
      ORDER BY fecha DESC NULLS LAST, id DESC LIMIT 1
    `,
    sql`
      SELECT DISTINCT v.nombre FROM vacuna_aplicada va
      JOIN vacunas v ON v.id = va.vacuna_id
      WHERE va.bovino_id = ${bovino.id} AND v.usuario_id = ${userId}
    `
  ]);

  const evaluation = evaluateVentaReadiness({
    nombre: String(bovino.nombre),
    peso: pesos[0]?.peso ?? null,
    vacunasAplicadas: vacunas.map((vacuna: any) => String(vacuna.nombre))
  });
  return { ...evaluation, answer: evaluation.respuesta };
}));
