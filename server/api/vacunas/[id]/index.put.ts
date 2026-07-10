import { sql } from "~/lib/db";
import { findVacunaByNombreUsuario, mensajeVacunaYaExiste } from "~/lib/vacunaService";
import { apiError, optionalText, parseId, requiredText, runApi } from "~/server/utils/api";
import { requireOwnedVacuna } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const body = await readBody(event);
  await requireOwnedVacuna(id, userId);
  const nombre = requiredText(body?.nombre, "nombre", 100);
  if (await findVacunaByNombreUsuario(nombre, userId, id)) {
    apiError({ statusCode: 409, code: "DUPLICATE", message: mensajeVacunaYaExiste(nombre) });
  }
  const rows = await sql`
    UPDATE vacunas SET nombre = ${nombre}, descripcion = ${optionalText(body?.descripcion)}
    WHERE id = ${id} AND usuario_id = ${userId} RETURNING *
  `;
  return rows[0];
}));
