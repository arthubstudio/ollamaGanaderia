import { sql } from "~/lib/db";
import { generarSiguienteArete } from "~/lib/areteService";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import {
  mensajeDatosBovinoFaltantes,
  validarDatosBovinoRegistro,
  type DatosBovinoRegistroInput
} from "~/lib/bovinoValidation";
import { optionalDate } from "~/server/utils/api";

export type CrearBovinoArgs = DatosBovinoRegistroInput & {
  fecha_nacimiento?: string;
  estado?: string;
};

export async function crearBovino(args: CrearBovinoArgs, usuarioId?: number | null) {
  if (!usuarioId) return { ok: false as const, error: "Se requiere sesion de usuario." };
  if (!args.nombre?.trim() || !args.raza?.trim() || !args.sexo?.trim()) {
    return { ok: false as const, error: mensajeDatosBovinoFaltantes() };
  }

  const validacion = validarDatosBovinoRegistro(args);
  if (!validacion.ok) return { ok: false as const, error: validacion.error };

  const existente = await sql`
    SELECT id FROM bovinos
    WHERE usuario_id = ${usuarioId}
      AND LOWER(nombre) = LOWER(${validacion.datos.nombre})
    LIMIT 1
  `;
  if (existente.length) {
    return { ok: false as const, error: "Ya existe un bovino con ese nombre en tu cuenta." };
  }

  const estado = String(args.estado ?? "activa").trim().toLowerCase();
  if (!['activa', 'vendida', 'baja'].includes(estado)) {
    return { ok: false as const, error: "El estado del bovino no es valido." };
  }

  try {
    const bovino = await sql.begin(async (tx) => {
      const numeroArete = await generarSiguienteArete(tx, usuarioId);
      const rows = await tx`
        INSERT INTO bovinos
          (usuario_id, numero_arete, nombre, raza, sexo, fecha_nacimiento, estado)
        VALUES
          (${usuarioId}, ${numeroArete}, ${validacion.datos.nombre},
           ${validacion.datos.raza}, ${validacion.datos.sexo},
           ${optionalDate(args.fecha_nacimiento, "La fecha de nacimiento")}, ${estado})
        RETURNING *
      `;
      return rows[0];
    });

    await rebuildBovinoContext(Number(bovino.id));
    return { ok: true as const, bovino };
  } catch (error: any) {
    if (error?.message === "ARETE_SEQUENCE_EXHAUSTED") {
      return { ok: false as const, error: "Se agotaron los aretes disponibles con el formato MX-0000." };
    }
    throw error;
  }
}
