import { db } from "~/lib/db";
import { bovinos } from "~/drizzle/schema";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { findBovinoByNombre } from "./findBovino";
import { eq } from "drizzle-orm";

import {
  mensajeDatosBovinoFaltantes,
  validarDatosBovino,
  type DatosBovinoInput
} from "~/lib/bovinoValidation";

export type CrearBovinoArgs = DatosBovinoInput & {
  fecha_nacimiento?: string;
  estado?: string;
};

export async function crearBovino(
  args: CrearBovinoArgs,
  usuarioId?: number | null
) {
  if (!usuarioId) {
    return {
      ok: false as const,
      error: "Se requiere sesión de usuario."
    };
  }

  if (
    !args.numero_arete?.trim() ||
    !args.nombre?.trim() ||
    !args.raza?.trim() ||
    !args.sexo?.trim()
  ) {
    return {
      ok: false as const,
      error: mensajeDatosBovinoFaltantes()
    };
  }

  const validacion = validarDatosBovino(args);

  if (!validacion.ok) {
    return {
      ok: false as const,
      error: validacion.error
    };
  }

  // ==========================================
  // ¿Ya existe un bovino con ese nombre?
  // ==========================================

  const existente = await findBovinoByNombre(
    validacion.datos.nombre,
    usuarioId
  );

  let bovino;

  if (existente) {

    const result = await db
      .update(bovinos)
      .set({

        numero_arete:
          validacion.datos.numero_arete,

        nombre:
          validacion.datos.nombre,

        raza:
          validacion.datos.raza,

        sexo:
          validacion.datos.sexo,

        fecha_nacimiento:
          args.fecha_nacimiento || null,

        estado:
          args.estado ?? "activa",

        updated_at:
          new Date()

      })
      .where(
        eq(
          bovinos.id,
          existente.id
        )
      )
      .returning();

    bovino = result[0];

  } else {

    const result = await db
      .insert(bovinos)
      .values({

        usuario_id:
          usuarioId,

        numero_arete:
          validacion.datos.numero_arete,

        nombre:
          validacion.datos.nombre,

        raza:
          validacion.datos.raza,

        sexo:
          validacion.datos.sexo,

        fecha_nacimiento:
          args.fecha_nacimiento || null,

        estado:
          args.estado ?? "activa"

      })
      .returning();

    bovino = result[0];

  }

  // ==========================================
  // Regenerar contexto IA
  // ==========================================

  await rebuildBovinoContext(
    bovino.id
  );

  return {
    ok: true as const,
    bovino
  };
}