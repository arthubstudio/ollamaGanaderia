import { sql } from "~/lib/db";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import {
  mensajeDatosBovinoFaltantes,
  validarDatosBovino,
  type DatosBovinoInput
} from "~/lib/bovinoValidation";
import { optionalDate } from "~/server/utils/api";

export type CrearBovinoArgs = DatosBovinoInput & {
  fecha_nacimiento?: string;
  estado?: string;
};

export async function crearBovino(args: CrearBovinoArgs, usuarioId?: number | null) {
  if (!usuarioId) return { ok: false as const, error: "Se requiere sesion de usuario." };
  if (!args.numero_arete?.trim() || !args.nombre?.trim() || !args.raza?.trim() || !args.sexo?.trim()) {
    return { ok: false as const, error: mensajeDatosBovinoFaltantes() };
  }

  const validacion = validarDatosBovino(args);
  if (!validacion.ok) return { ok: false as const, error: validacion.error };

  const existente = await sql`
    SELECT id, nombre, numero_arete FROM bovinos
    WHERE LOWER(numero_arete) = LOWER(${validacion.datos.numero_arete})
       OR (usuario_id = ${usuarioId} AND LOWER(nombre) = LOWER(${validacion.datos.nombre}))
    LIMIT 1
  `;
  if (existente.length) {
    return {
      ok: false as const,
      error: `Ya existe un bovino con el nombre o arete indicado.`
    };
  }

  const estado = String(args.estado ?? "activa").trim().toLowerCase();
  if (!["activa", "vendida", "baja"].includes(estado)) {
    return { ok: false as const, error: "El estado del bovino no es valido." };
  }

  const rows = await sql`
    INSERT INTO bovinos
      (usuario_id, numero_arete, nombre, raza, sexo, fecha_nacimiento, estado)
    VALUES
      (${usuarioId}, ${validacion.datos.numero_arete}, ${validacion.datos.nombre},
       ${validacion.datos.raza}, ${validacion.datos.sexo},
       ${optionalDate(args.fecha_nacimiento, "La fecha de nacimiento")}, ${estado})
    RETURNING *
  `;
  await rebuildBovinoContext(Number(rows[0].id));
  return { ok: true as const, bovino: rows[0] };
}
