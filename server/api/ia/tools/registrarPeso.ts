import { db } from "~/lib/db";
import { pesos } from "~/drizzle/schema";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { findBovinoByNombre } from "./findBovino";

export type RegistrarPesoArgs = {
  nombre: string;
  peso: number;
  fecha?: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function registrarPeso(
  args: RegistrarPesoArgs,
  usuarioId?: number | null
) {
  if (!usuarioId) {
    return { ok: false as const, error: "Se requiere sesión de usuario." };
  }

  if (!args.nombre?.trim() || !args.peso || args.peso <= 0) {
    return {
      ok: false as const,
      error: "Indica el nombre de la vaca y un peso válido en kg."
    };
  }

  const vaca = await findBovinoByNombre(args.nombre.trim(), usuarioId);
  if (!vaca) {
    return {
      ok: false as const,
      error: `No encontré la vaca "${args.nombre}" en tu cuenta.`
    };
  }

  const result = await db
    .insert(pesos)
    .values({
      bovino_id: vaca.id,
      peso: String(args.peso),
      fecha: args.fecha?.trim() || todayIsoDate()
    })
    .returning();

  await rebuildBovinoContext(vaca.id);

  return {
    ok: true as const,
    registro: result[0],
    bovino: vaca
  };
}
