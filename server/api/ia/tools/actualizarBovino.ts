import { db } from "~/lib/db";
import { bovinos } from "~/drizzle/schema";
import { eq } from "drizzle-orm";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { findBovinoByNombre } from "./findBovino";

export type ActualizarBovinoArgs = {
  nombre: string;

  nuevo_nombre?: string;
  numero_arete?: string;
  raza?: string;
  sexo?: string;
  fecha_nacimiento?: string;
  estado?: string;
};

export async function actualizarBovino(
  args: ActualizarBovinoArgs,
  usuarioId?: number | null
) {
  if (!usuarioId) {
    return {
      ok: false as const,
      error: "Se requiere sesión."
    };
  }

  if (!args.nombre?.trim()) {
    return {
      ok: false as const,
      error: "Debes indicar el nombre del bovino."
    };
  }

  const bovino = await findBovinoByNombre(
    args.nombre.trim(),
    usuarioId
  );

  if (!bovino) {
    return {
      ok: false as const,
      error: `No encontré el bovino "${args.nombre}".`
    };
  }

  const cambios: any = {};

  if (args.nuevo_nombre?.trim()) {
    cambios.nombre = args.nuevo_nombre.trim();
  }

  if (args.numero_arete?.trim()) {
    cambios.numero_arete = args.numero_arete.trim();
  }

  if (args.raza?.trim()) {
    cambios.raza = args.raza.trim();
  }

  if (args.sexo?.trim()) {
    cambios.sexo = args.sexo.trim();
  }

  if (args.estado?.trim()) {
    cambios.estado = args.estado.trim();
  }

  if (args.fecha_nacimiento) {
    cambios.fecha_nacimiento = args.fecha_nacimiento;
  }

  if (Object.keys(cambios).length === 0) {
    return {
      ok: false as const,
      error: "No hay datos para actualizar."
    };
  }

  cambios.updated_at = new Date();

  const result = await db
    .update(bovinos)
    .set(cambios)
    .where(eq(bovinos.id, bovino.id))
    .returning();

  await rebuildBovinoContext(bovino.id);

  return {
    ok: true as const,
    bovino: result[0]
  };
}