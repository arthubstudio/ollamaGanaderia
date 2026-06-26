import { db } from "~/lib/db";
import { enfermedades } from "~/drizzle/schema";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { findBovinoByNombre } from "./findBovino";

export type RegistrarEnfermedadArgs = {
  nombre: string;
  enfermedad: string;
  tratamiento?: string;
  fecha?: string;
  veterinario?: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function registrarEnfermedad(
  args: RegistrarEnfermedadArgs,
  usuarioId?: number | null
) {
  if (!usuarioId) {
    return { ok: false as const, error: "Se requiere sesión de usuario." };
  }

  if (!args.nombre?.trim() || !args.enfermedad?.trim()) {
    return {
      ok: false as const,
      error: "Indica el nombre de la vaca y la enfermedad."
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
    .insert(enfermedades)
    .values({
      bovino_id: vaca.id,
      nombre: args.enfermedad.trim(),
      tratamiento: args.tratamiento?.trim() ?? null,
      fecha: args.fecha?.trim() || todayIsoDate(),
      veterinario: args.veterinario?.trim() ?? null
    })
    .returning();

  await rebuildBovinoContext(vaca.id);

  return {
    ok: true as const,
    registro: result[0],
    bovino: vaca
  };
}
