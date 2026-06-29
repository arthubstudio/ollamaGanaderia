import { db } from "~/lib/db";
import { pesos } from "~/drizzle/schema";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { findBovinoByNombre } from "./findBovino";
import { desc, eq } from "drizzle-orm";

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
    return {
      ok: false as const,
      error: "Se requiere sesión de usuario."
    };
  }

  if (!args.nombre?.trim() || !args.peso || args.peso <= 0) {
    return {
      ok: false as const,
      error: "Indica el nombre del bovino y un peso válido."
    };
  }

  const bovino = await findBovinoByNombre(
    args.nombre.trim(),
    usuarioId
  );

  if (!bovino) {
    return {
      ok: false as const,
      error: `No encontré el bovino "${args.nombre}" en tu cuenta.`
    };
  }

  const ultimoPeso = await db
    .select()
    .from(pesos)
    .where(eq(pesos.bovino_id, bovino.id))
    .orderBy(desc(pesos.fecha), desc(pesos.id))
    .limit(1);

  let registro;

  if (ultimoPeso.length) {
    const result = await db
      .update(pesos)
      .set({
        peso: String(args.peso),
        fecha: args.fecha?.trim() || todayIsoDate()
      })
      .where(eq(pesos.id, ultimoPeso[0].id))
      .returning();

    registro = result[0];
  } else {
    const result = await db
      .insert(pesos)
      .values({
        bovino_id: bovino.id,
        peso: String(args.peso),
        fecha: args.fecha?.trim() || todayIsoDate()
      })
      .returning();

    registro = result[0];
  }

  await rebuildBovinoContext(bovino.id);

  return {
    ok: true as const,
    registro,
    bovino
  };
}