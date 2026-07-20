import { sql } from "~/lib/db";
import { apiError, optionalDate, optionalText, parseId } from "~/server/utils/api";
import { addMonthsToIsoDate, evaluateVaccineInterval } from "~/lib/vaccinationInterval.js";

export async function applyVaccineToBovino(input: {
  userId: number;
  bovinoId: number;
  vacunaId: number;
  fechaAplicacion?: unknown;
  veterinario?: unknown;
  observaciones?: unknown;
}) {
  const fechaAplicacion = optionalDate(input.fechaAplicacion, "La fecha de aplicacion") ??
    new Date().toISOString().slice(0, 10);
  const veterinario = optionalText(input.veterinario, 100);
  const observaciones = optionalText(input.observaciones);

  return sql.begin(async (tx) => {
    const relations = await tx`
      SELECT b.id AS bovino_id, b.nombre AS bovino_nombre,
             b.sexo, v.id AS vacuna_id, v.nombre AS vacuna_nombre
      FROM bovinos b
      JOIN vacunas v ON v.id = ${input.vacunaId}
      WHERE b.id = ${input.bovinoId}
        AND b.usuario_id = ${input.userId}
        AND v.usuario_id = ${input.userId}
      LIMIT 1
    `;
    if (!relations.length) {
      apiError({
        statusCode: 404,
        code: "VACCINATION_RELATION_NOT_FOUND",
        message: "El bovino o la vacuna no existen en tu cuenta."
      });
    }

    await tx`SELECT pg_advisory_xact_lock(${input.bovinoId}, ${input.vacunaId})`;
    const previous = await tx`
      SELECT id, fecha_aplicacion
      FROM vacuna_aplicada
      WHERE bovino_id = ${input.bovinoId}
        AND vacuna_id = ${input.vacunaId}
      ORDER BY fecha_aplicacion DESC NULLS LAST, id DESC
      LIMIT 1
    `;
    const lastDate = previous[0]?.fecha_aplicacion
      ? String(previous[0].fecha_aplicacion).slice(0, 10)
      : null;
    const interval = evaluateVaccineInterval(lastDate, fechaAplicacion);
    if (!interval.allowed) {
      apiError({
        statusCode: 409,
        code: "VACCINE_INTERVAL_NOT_REACHED",
        message: interval.message
      });
    }

    const rows = await tx`
      INSERT INTO vacuna_aplicada (
        bovino_id, vacuna_id, fecha_aplicacion,
        proxima_fecha_permitida, aplicada_por_usuario_id,
        veterinario, observaciones
      ) VALUES (
        ${input.bovinoId}, ${input.vacunaId}, ${fechaAplicacion},
        ${interval.nextAllowedDate}, ${input.userId},
        ${veterinario}, ${observaciones}
      )
      RETURNING *
    `;

    return {
      aplicacion: rows[0],
      bovino: {
        id: Number(relations[0].bovino_id),
        nombre: String(relations[0].bovino_nombre),
        sexo: relations[0].sexo ? String(relations[0].sexo) : null
      },
      vacuna: {
        id: Number(relations[0].vacuna_id),
        nombre: String(relations[0].vacuna_nombre)
      }
    };
  });
}

export async function updateVaccineApplication(input: {
  userId: number;
  applicationId: unknown;
  vacunaId: unknown;
  fechaAplicacion: unknown;
  veterinario?: unknown;
  observaciones?: unknown;
}) {
  const applicationId = parseId(input.applicationId, "aplicacion_id");
  const vacunaId = parseId(input.vacunaId, "vacuna_id");
  const fechaAplicacion = optionalDate(input.fechaAplicacion, "La fecha de aplicacion");
  if (!fechaAplicacion) {
    apiError({ statusCode: 400, code: "REQUIRED_DATE", message: "La fecha de aplicacion es obligatoria." });
  }

  return sql.begin(async (tx) => {
    const rows = await tx`
      SELECT va.*, b.usuario_id
      FROM vacuna_aplicada va
      JOIN bovinos b ON b.id = va.bovino_id
      JOIN vacunas v ON v.id = ${vacunaId} AND v.usuario_id = ${input.userId}
      WHERE va.id = ${applicationId} AND b.usuario_id = ${input.userId}
      FOR UPDATE OF va
    `;
    const current = rows[0];
    if (!current) {
      apiError({ statusCode: 404, code: "NOT_FOUND", message: "Vacuna aplicada no encontrada." });
    }

    const bovinoId = Number(current.bovino_id);
    await tx`SELECT pg_advisory_xact_lock(${bovinoId}, ${vacunaId})`;
    const neighbours = await tx`
      SELECT fecha_aplicacion
      FROM vacuna_aplicada
      WHERE bovino_id = ${bovinoId}
        AND vacuna_id = ${vacunaId}
        AND id <> ${applicationId}
      ORDER BY fecha_aplicacion ASC, id ASC
    `;
    const dates = neighbours
      .map((item: any) => String(item.fecha_aplicacion ?? "").slice(0, 10))
      .filter(Boolean);
    const previousDate = [...dates].reverse().find((date) => date <= fechaAplicacion) ?? null;
    const previousInterval = evaluateVaccineInterval(previousDate, fechaAplicacion);
    if (!previousInterval.allowed) {
      apiError({ statusCode: 409, code: "VACCINE_INTERVAL_NOT_REACHED", message: previousInterval.message });
    }

    const nextDate = dates.find((date) => date > fechaAplicacion) ?? null;
    const nextAllowedDate = addMonthsToIsoDate(fechaAplicacion);
    if (nextDate && nextDate < nextAllowedDate) {
      apiError({
        statusCode: 409,
        code: "VACCINE_INTERVAL_CONFLICT",
        message: `Ya existe otra aplicacion el ${nextDate}. Las aplicaciones de la misma vacuna deben guardar seis meses de diferencia.`
      });
    }

    const updated = await tx`
      UPDATE vacuna_aplicada
      SET vacuna_id = ${vacunaId},
          fecha_aplicacion = ${fechaAplicacion},
          proxima_fecha_permitida = ${nextAllowedDate},
          aplicada_por_usuario_id = ${input.userId},
          veterinario = ${optionalText(input.veterinario, 100)},
          observaciones = ${optionalText(input.observaciones)}
      WHERE id = ${applicationId}
      RETURNING *
    `;
    return updated[0];
  });
}
