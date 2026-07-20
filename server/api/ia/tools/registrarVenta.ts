import { sql } from "~/lib/db";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { optionalDate, optionalText } from "~/server/utils/api";
import { findBovinoByNombre } from "./findBovino";

export async function registrarVenta(args: {
  nombre: string;
  comprador: string;
  precio: number;
  fecha?: string;
  observaciones?: string;
}, usuarioId?: number | null) {
  if (!usuarioId) return { ok: false as const, error: "Se requiere sesion de usuario." };
  if (!args.nombre?.trim()) return { ok: false as const, error: "Indica el bovino que deseas vender." };
  if (!args.comprador?.trim()) return { ok: false as const, error: "Indica el comprador." };
  if (!Number.isFinite(Number(args.precio)) || Number(args.precio) <= 0) {
    return { ok: false as const, error: "Indica un precio valido mayor que cero." };
  }

  const bovino = await findBovinoByNombre(args.nombre.trim(), usuarioId);
  if (!bovino) {
    return { ok: false as const, error: `No encontre el bovino "${args.nombre}" en tu cuenta.` };
  }
  if (String(bovino.estado ?? "activa").toLowerCase() === "vendida") {
    return { ok: false as const, error: `${bovino.nombre} ya aparece como vendido.` };
  }

  const fecha = optionalDate(args.fecha, "La fecha") ?? new Date().toISOString().slice(0, 10);
  const result = await sql.begin(async (tx) => {
    const rows = await tx`
      INSERT INTO ventas (bovino_id, comprador, precio, fecha, observaciones)
      VALUES (
        ${bovino.id}, ${args.comprador.trim()}, ${Number(args.precio)},
        ${fecha}, ${optionalText(args.observaciones)}
      )
      RETURNING *
    `;
    await tx`
      UPDATE bovinos SET estado = 'vendida', updated_at = NOW()
      WHERE id = ${bovino.id} AND usuario_id = ${usuarioId}
    `;
    return rows[0];
  });

  await rebuildBovinoContext(Number(bovino.id));
  return { ok: true as const, venta: result, bovino: { ...bovino, estado: "vendida" } };
}
