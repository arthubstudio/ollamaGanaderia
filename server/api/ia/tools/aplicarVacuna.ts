import postgres from "postgres";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { crearVacunaUsuario } from "~/lib/vacunaService";
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

function labelBovino(bovino: { nombre?: string | null; sexo?: string | null }) {
  const sexo = String(bovino.sexo ?? "").toLowerCase();
  if (sexo.includes("macho")) return "bovino";
  if (sexo.includes("hembra")) return "vaca";
  return "bovino";
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
      error: "Indica el nombre del bovino y de la vacuna."
    };
  }

  const vaca = await findBovinoByNombre(args.nombre_vaca.trim(), usuarioId);
  if (!vaca) {
    return {
      ok: false as const,
      error: `No encontré el bovino "${args.nombre_vaca}" en tu cuenta.`
    };
  }

  let vacunaCreada = false;
  const vacunaRows = await sql`
    SELECT id, nombre
    FROM vacunas
    WHERE LOWER(nombre) = LOWER(${args.vacuna_nombre.trim()})
      AND usuario_id = ${usuarioId}
    LIMIT 1
  `;

  let vacuna: { id: number; nombre: string };

  if (!vacunaRows.length) {
    const creada = await crearVacunaUsuario({
      nombre: args.vacuna_nombre.trim(),
      usuarioId
    });

    if (!creada.ok) {
      return { ok: false as const, error: creada.error };
    }

    vacunaCreada = true;
    vacuna = {
      id: Number(creada.vacuna.id),
      nombre: String(creada.vacuna.nombre)
    };
  } else {
    vacuna = {
      id: Number(vacunaRows[0].id),
      nombre: String(vacunaRows[0].nombre)
    };
  }
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
    vacuna,
    vacunaCreada,
    labelBovino: labelBovino(vaca)
  };
}
