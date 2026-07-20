import { sql } from "~/lib/db";
import { generarSiguienteArete } from "~/lib/areteService";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import {
  mensajeDatosBovinoFaltantes,
  validarDatosBovinoRegistro,
  type DatosBovinoRegistroInput
} from "~/lib/bovinoValidation";
import { optionalDate } from "~/server/utils/api";
import { findBreedByName } from "~/server/services/breedService";
import {
  getRanchoOwnerIds,
  normalizeRelationIds,
  requireOwnedActiveRancho,
  requireOwnedRelationIds,
  syncBovinoOwners,
  syncRanchoOwners
} from "~/server/services/ownershipRelations";

export type CrearBovinoArgs = DatosBovinoRegistroInput & {
  breed_id?: number;
  fecha_nacimiento?: string;
  estado?: string;
  rancho_id?: number;
  dueno_id?: number;
  dueno_ids?: number[];
};

export async function crearBovino(args: CrearBovinoArgs, usuarioId?: number | null) {
  if (!usuarioId) return { ok: false as const, error: "Se requiere sesion de usuario." };
  if (!args.nombre?.trim() || !args.raza?.trim() || !args.sexo?.trim()) {
    return { ok: false as const, error: mensajeDatosBovinoFaltantes() };
  }

  const breedRows = args.breed_id
    ? await sql`SELECT * FROM breeds WHERE id = ${args.breed_id} AND activo = TRUE LIMIT 1`
    : [];
  const breed = breedRows[0] ?? await findBreedByName(args.raza);
  if (!breed) {
    return {
      ok: false as const,
      error: `La raza "${args.raza.trim()}" no existe registrada. Deseas crearla?`,
      requiresBreedCreation: true as const,
      requestedBreed: args.raza.trim()
    };
  }

  const validacion = validarDatosBovinoRegistro({ ...args, raza: String(breed.nombre) });
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
      const ranchoId = args.rancho_id ? Number(args.rancho_id) : null;
      if (ranchoId && (!Number.isInteger(ranchoId) || ranchoId <= 0)) {
        return { relationError: "El rancho seleccionado no es valido." } as const;
      }
      await requireOwnedActiveRancho(tx, usuarioId, ranchoId);
      const explicitOwnerIds = normalizeRelationIds(args.dueno_ids, args.dueno_id);
      await requireOwnedRelationIds(tx, usuarioId, explicitOwnerIds);
      const ranchoOwnerIds = await getRanchoOwnerIds(tx, ranchoId);
      const ownerIds = explicitOwnerIds.length ? explicitOwnerIds : ranchoOwnerIds;

      if (ranchoId && explicitOwnerIds.length) {
        const combinedRanchoOwners = [...new Set([...ranchoOwnerIds, ...explicitOwnerIds])];
        await syncRanchoOwners({
          client: tx,
          userId: usuarioId,
          ranchoId,
          duenoIds: combinedRanchoOwners
        });
      }

      const numeroArete = await generarSiguienteArete(tx, usuarioId);
      const rows = await tx`
        INSERT INTO bovinos
          (usuario_id, created_by_user_id, rancho_id, numero_arete,
           nombre, raza, breed_id, sexo, fecha_nacimiento, estado)
        VALUES
          (${usuarioId}, ${usuarioId}, ${ranchoId}, ${numeroArete}, ${validacion.datos.nombre},
           ${validacion.datos.raza}, ${breed.id}, ${validacion.datos.sexo},
           ${optionalDate(args.fecha_nacimiento, "La fecha de nacimiento")}, ${estado})
        RETURNING *
      `;
      const created = rows[0];
      await tx`
        INSERT INTO historial_propiedad (
          bovino_id, dueno_id, rancho_id, propietario_usuario_id,
          fecha_inicio, observaciones
        ) VALUES (
          ${created.id}, ${ownerIds[0] ?? null}, ${ranchoId}, ${usuarioId}, CURRENT_DATE,
          'Propietario asignado automaticamente al registrar el bovino.'
        )
      `;
      await syncBovinoOwners({
        client: tx,
        userId: usuarioId,
        bovinoId: Number(created.id),
        duenoIds: ownerIds
      });
      return { ...created, dueno_ids: ownerIds };
    });

    if ("relationError" in bovino) {
      return { ok: false as const, error: bovino.relationError };
    }

    await rebuildBovinoContext(Number(bovino.id));
    return { ok: true as const, bovino };
  } catch (error: any) {
    if (error?.message === "ARETE_SEQUENCE_EXHAUSTED") {
      return { ok: false as const, error: "Se agotaron los aretes disponibles con el formato MX-0000." };
    }
    throw error;
  }
}
