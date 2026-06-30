import postgres from "postgres";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { findBovinoByNombre } from "./findBovino";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

export type TransferirPropiedadArgs = {
  nombre_vaca: string;
  dueno_nombre?: string;
  rancho_nombre?: string;
  fecha_inicio?: string;
  observaciones?: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function findOrCreateDueno(nombre: string, usuarioId: number) {
  const rows = await sql`
    SELECT id, nombre
    FROM duenos
    WHERE usuario_id = ${usuarioId}
      AND LOWER(nombre) = LOWER(${nombre})
    LIMIT 1
  `;

  if (rows.length) {
    return {
      dueno: { id: Number(rows[0].id), nombre: String(rows[0].nombre) },
      creado: false
    };
  }

  const created = await sql`
    INSERT INTO duenos (nombre, usuario_id)
    VALUES (${nombre}, ${usuarioId})
    RETURNING id, nombre
  `;

  return {
    dueno: { id: Number(created[0].id), nombre: String(created[0].nombre) },
    creado: true
  };
}

async function findOrCreateRancho(
  nombre: string,
  usuarioId: number,
  duenoId?: number | null
) {
  const rows = await sql`
    SELECT id, nombre
    FROM ranchos
    WHERE usuario_id = ${usuarioId}
      AND LOWER(nombre) = LOWER(${nombre})
    LIMIT 1
  `;

  if (rows.length) {
    return {
      rancho: { id: Number(rows[0].id), nombre: String(rows[0].nombre) },
      creado: false
    };
  }

  const created = await sql`
    INSERT INTO ranchos (nombre, usuario_id, dueno_id)
    VALUES (${nombre}, ${usuarioId}, ${duenoId ?? null})
    RETURNING id, nombre
  `;

  return {
    rancho: { id: Number(created[0].id), nombre: String(created[0].nombre) },
    creado: true
  };
}

export async function transferirPropiedad(
  args: TransferirPropiedadArgs,
  usuarioId?: number | null
) {
  if (!usuarioId) {
    return { ok: false as const, error: "Se requiere sesión de usuario." };
  }

  if (!args.nombre_vaca?.trim()) {
    return {
      ok: false as const,
      error: "Indica el nombre del bovino."
    };
  }

  if (!args.dueno_nombre?.trim() && !args.rancho_nombre?.trim()) {
    return {
      ok: false as const,
      error: "Indica el dueño o el rancho para la transferencia."
    };
  }

  const bovino = await findBovinoByNombre(args.nombre_vaca.trim(), usuarioId);
  if (!bovino) {
    return {
      ok: false as const,
      error: `No encontré el bovino "${args.nombre_vaca}" en tu cuenta.`
    };
  }

  let dueno: { id: number; nombre: string } | null = null;
  let rancho: { id: number; nombre: string } | null = null;
  let duenoCreado = false;
  let ranchoCreado = false;

  if (args.dueno_nombre?.trim()) {
    const duenoResult = await findOrCreateDueno(
      args.dueno_nombre.trim(),
      usuarioId
    );
    dueno = duenoResult.dueno;
    duenoCreado = duenoResult.creado;
  }

  if (args.rancho_nombre?.trim()) {
    const ranchoResult = await findOrCreateRancho(
      args.rancho_nombre.trim(),
      usuarioId,
      dueno?.id ?? null
    );
    rancho = ranchoResult.rancho;
    ranchoCreado = ranchoResult.creado;
  }

  const fecha = args.fecha_inicio?.trim() || todayIsoDate();

  await sql`
    UPDATE historial_propiedad
    SET fecha_fin = ${fecha}
    WHERE bovino_id = ${bovino.id}
      AND fecha_fin IS NULL
  `;

  const rows = await sql`
    INSERT INTO historial_propiedad (
      bovino_id,
      dueno_id,
      rancho_id,
      fecha_inicio,
      fecha_fin,
      observaciones
    )
    VALUES (
      ${bovino.id},
      ${dueno?.id ?? null},
      ${rancho?.id ?? null},
      ${fecha},
      NULL,
      ${args.observaciones?.trim() ?? null}
    )
    RETURNING *
  `;

  await rebuildBovinoContext(bovino.id);

  return {
    ok: true as const,
    historial: rows[0],
    bovino,
    dueno,
    rancho,
    duenoCreado,
    ranchoCreado
  };
}
