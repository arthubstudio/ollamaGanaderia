import { db } from "~/lib/db";
import { eq } from "drizzle-orm";
import {
  vacas,
  pesos,
  vacunaAplicada,
  enfermedades,
  historialPropiedad,
  ventas,
  semanticContexts,
} from "~/drizzle/schema";

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id);

  await db.transaction(async (tx) => {
    await tx.delete(semanticContexts).where(eq(semanticContexts.vaca_id, id));
    await tx.delete(vacunaAplicada).where(eq(vacunaAplicada.vaca_id, id));
    await tx.delete(pesos).where(eq(pesos.vaca_id, id));
    await tx.delete(enfermedades).where(eq(enfermedades.vaca_id, id));
    await tx.delete(ventas).where(eq(ventas.vaca_id, id));
    await tx.delete(historialPropiedad).where(eq(historialPropiedad.vaca_id, id));
    await tx.delete(vacas).where(eq(vacas.id, id));
  });

  return { ok: true };
});