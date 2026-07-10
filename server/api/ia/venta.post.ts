import { sql } from "~/lib/db";
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
  if (!rows.length) return { lista: false, respuesta: "No encontre ese bovino en tu cuenta." };

  const bovino = rows[0];
  const pesos = await sql`
    SELECT peso, fecha FROM pesos WHERE bovino_id = ${bovino.id}
    ORDER BY fecha DESC NULLS LAST, id DESC LIMIT 1
  `;
  if (!pesos.length) {
    return {
      lista: false,
      respuesta: `No puedo determinar si ${bovino.nombre} esta lista para venta porque no tiene un peso registrado.`
    };
  }

  const requisitos = await sql`
    SELECT nombre FROM requisitos_venta WHERE obligatorio = true ORDER BY nombre
  `;
  if (!requisitos.length) {
    return {
      lista: false,
      respuesta: `No puedo determinar si ${bovino.nombre} esta lista para venta porque no hay requisitos de venta configurados.`
    };
  }

  const aplicadas = await sql`
    SELECT LOWER(v.nombre) AS nombre FROM vacuna_aplicada va
    JOIN vacunas v ON v.id = va.vacuna_id
    WHERE va.bovino_id = ${bovino.id} AND v.usuario_id = ${userId}
  `;
  const setAplicadas = new Set(aplicadas.map((row: any) => String(row.nombre)));
  const faltantes = requisitos.filter((row: any) =>
    !setAplicadas.has(String(row.nombre).toLowerCase())
  );
  if (faltantes.length) {
    return {
      lista: false,
      respuesta: `${bovino.nombre} no cumple todos los requisitos de vacunacion configurados. Faltan: ${faltantes.map((row: any) => row.nombre).join(", ")}.`
    };
  }

  return {
    lista: false,
    respuesta: `${bovino.nombre} tiene peso y vacunas registradas, pero no puedo determinar si esta lista para venta porque no hay una regla de peso minimo configurada.`
  };
}));
