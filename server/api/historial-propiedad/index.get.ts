import { db } from "~/lib/db";

import {
  historialPropiedad,
  vacas
} from "~/drizzle/schema";

import {
  eq
} from "drizzle-orm";

export default defineEventHandler(
  async (event) => {

    const query =
      getQuery(event);

    const usuarioId =
      Number(
        query.usuario_id
      );

    if (!usuarioId) {
      return [];
    }

    const result =
      await db
        .select()
        .from(historialPropiedad)
        .innerJoin(
          vacas,
          eq(
            historialPropiedad.vaca_id,
            vacas.id
          )
        )
        .where(
          eq(
            vacas.usuario_id,
            usuarioId
          )
        );

    return result.map(
      (row: any) =>
        row.historial_propiedad
    );

  }
);