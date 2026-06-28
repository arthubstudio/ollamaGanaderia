import { db } from "~/lib/db";

import {
  historialPropiedad,
  bovinos
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
          bovinos,
          eq(
            historialPropiedad.bovino_id,
            bovinos.id
          )
        )
        .where(
          eq(
            bovinos.usuario_id,
            usuarioId
          )
        );

    return result.map(
      (row: any) =>
        row.historial_propiedad
    );

  }
);