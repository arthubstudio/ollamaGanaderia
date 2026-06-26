import postgres from "postgres";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { findBovinoByNombre } from "./findBovino";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

export type AplicarVacunaArgs = {
  nombre_vaca: string;
  vacuna_nombre: string;
  fecha_aplicacion?: string;
  veterinario?: string;
  observaciones?: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function aplicarVacuna(
  args: AplicarVacunaArgs,
  usuarioId?: number | null
) {
  if (!usuarioId) {
    return { ok: false as const, error: "Se requiere sesión de usuario." };
  }

  if (!args.nombre_vaca?.trim() || !args.vacuna_nombre?.trim()) {
    return {
      ok: false as const,
      error: "Indica el nombre de la vaca y de la vacuna."
    };
  }

  const vaca = await findBovinoByNombre(args.nombre_vaca.trim(), usuarioId);
  if (!vaca) {
    return {
      ok: false as const,
      error: `No encontré la vaca "${args.nombre_vaca}" en tu cuenta.`
    };
  }

  const vacunaRows = await sql`
    SELECT id, nombre
    FROM vacunas
    WHERE LOWER(nombre) = LOWER(${args.vacuna_nombre.trim()})
      AND usuario_id = ${usuarioId}
    LIMIT 1
  `;

  if (!vacunaRows.length) {
    return {
      ok: false as const,
      error: `No encontré la vacuna "${args.vacuna_nombre}" en tu catálogo. Puedes crearla primero.`
    };
  }

  const vacuna = vacunaRows[0];
  const fecha = args.fecha_aplicacion?.trim() || todayIsoDate();

  const rows = await sql`
    INSERT INTO vacuna_aplicada (
      bovino_id,
      vacuna_id,
      fecha_aplicacion,
      veterinario,
      observaciones
    )
    VALUES (
      ${vaca.id},
      ${vacuna.id},
      ${fecha},
      ${args.veterinario?.trim() ?? null},
      ${args.observaciones?.trim() ?? null}
    )
    RETURNING *
  `;

  await rebuildBovinoContext(vaca.id);

  return {
    ok: true as const,
    aplicacion: rows[0],
    bovino: vaca,
    vacuna
  };
}
