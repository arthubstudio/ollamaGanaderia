import { db } from "~/lib/db";
import { bovinos, breeds } from "~/drizzle/schema";
import { eq } from "drizzle-orm";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { findBovinoByNombre } from "./findBovino";
import { findBreedByName } from "~/server/services/breedService";

export type ActualizarBovinoArgs = {
  nombre: string;

  nuevo_nombre?: string;
  numero_arete?: string;
  raza?: string;
  breed_id?: number;
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
    const breedRows = args.breed_id
      ? await db.select().from(breeds).where(eq(breeds.id, args.breed_id)).limit(1)
      : [];
    const breed = breedRows[0] ?? await findBreedByName(args.raza);
    if (!breed || !breed.activo) {
      return {
        ok: false as const,
        error: `La raza "${args.raza.trim()}" no existe registrada.`,
        requiresBreedCreation: true as const,
        requestedBreed: args.raza.trim()
      };
    }
    cambios.raza = breed.nombre;
    cambios.breed_id = Number(breed.id);
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
