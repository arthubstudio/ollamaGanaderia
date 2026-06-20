import { db } from "~/lib/db";

import {
  historialPropiedad,
  vacas
} from "~/drizzle/schema";

import {
  and,
  eq,
  isNull
} from "drizzle-orm";

import {
  rebuildVacaContext
} from "~/lib/rebuildVacaContext";

export default defineEventHandler(
  async (event) => {

    const body =
      await readBody(event);

    const usuarioId =
      Number(
        body.usuario_id
      );

    if (!usuarioId) {

      throw createError({
        statusCode: 401,
        statusMessage:
          "Usuario no válido"
      });

    }

    const vaca =
      await db
        .select()
        .from(vacas)
        .where(
          and(
            eq(
              vacas.id,
              body.vaca_id
            ),
            eq(
              vacas.usuario_id,
              usuarioId
            )
          )
        );

    if (!vaca.length) {

      throw createError({
        statusCode: 403,
        statusMessage:
          "La vaca no pertenece al usuario"
      });

    }

    await db
      .update(
        historialPropiedad
      )
      .set({
        fecha_fin:
          body.fecha_inicio,
      })
      .where(
        and(
          eq(
            historialPropiedad.vaca_id,
            body.vaca_id
          ),
          isNull(
            historialPropiedad.fecha_fin
          )
        )
      );

    const result =
      await db
        .insert(
          historialPropiedad
        )
        .values({

          vaca_id:
            body.vaca_id,

          dueno_id:
            body.dueno_id,

          rancho_id:
            body.rancho_id,

          fecha_inicio:
            body.fecha_inicio,

          fecha_fin:
            null,

          observaciones:
            body.observaciones

        })
        .returning();

    await rebuildVacaContext(
      body.vaca_id
    );

    return result[0];

  }
);