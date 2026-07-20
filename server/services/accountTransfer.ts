import { sql } from "~/lib/db";
import { generarSiguienteArete } from "~/lib/areteService";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { recordActivity } from "~/server/services/activityAudit";
import { resolveTransferUser } from "~/server/services/userDirectory";
import { getRanchoOwnerIds, syncBovinoOwners } from "~/server/services/ownershipRelations";
import { apiError, optionalId, optionalText, parseId } from "~/server/utils/api";

export type TransferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "EXPIRED";

type TransferFailureReason =
  | "bovino_required"
  | "destination_required"
  | "bovino_not_found"
  | "user_not_found"
  | "ambiguous_user"
  | "pending_exists"
  | "self_transfer"
  | "internal_error";

async function transferFailure(input: {
  sourceUserId: number;
  bovinoId?: unknown;
  bovinoName?: unknown;
  destinationQuery?: unknown;
}, reason: TransferFailureReason, error: string, extra: Record<string, unknown> = {}) {
  const metadata = {
    reason,
    bovino_id: input.bovinoId ?? null,
    bovino_name: String(input.bovinoName ?? "").trim() || null,
    destination_query: String(input.destinationQuery ?? "").trim() || null,
    ...extra
  };

  console.warn("Solicitud de transferencia rechazada", {
    source_user_id: input.sourceUserId,
    ...metadata
  });

  try {
    await recordActivity({
      actorUserId: input.sourceUserId,
      action: "transfer.request_failed",
      entityType: "bovino_transfer",
      success: false,
      metadata
    });
  } catch (auditError) {
    console.error("No se pudo registrar el fallo de transferencia", {
      reason,
      auditError
    });
  }

  return { ok: false as const, reason, error, ...extra };
}

async function expirePendingTransfers() {
  const expired = await sql`
    UPDATE bovino_transfers
    SET status = 'EXPIRED', responded_at = NOW(), updated_at = NOW()
    WHERE status = 'PENDING' AND expires_at <= NOW()
    RETURNING id, bovino_id, source_user_id, destination_user_id
  `;

  for (const item of expired) {
    await sql`
      INSERT INTO bovino_transfer_events (
        transfer_id, bovino_id, event_type, from_user_id, to_user_id, metadata
      ) VALUES (
        ${item.id}, ${item.bovino_id}, 'EXPIRED',
        ${item.source_user_id}, ${item.destination_user_id}, '{}'::jsonb
      )
    `;
  }
}

async function ensureDestinationRancho(client: any, ranchoId: number | null, destinationUserId: number) {
  if (!ranchoId) return null;
  const rows = await client`
    SELECT id, nombre FROM ranchos
    WHERE id = ${ranchoId} AND usuario_id = ${destinationUserId}
    LIMIT 1
  `;
  if (!rows.length) {
    apiError({
      statusCode: 400,
      code: "INVALID_DESTINATION_RANCHO",
      message: "El rancho destino no pertenece al usuario receptor."
    });
  }
  return rows[0];
}

export async function createBovinoTransfer(input: {
  sourceUserId: number;
  bovinoId?: unknown;
  bovinoName?: unknown;
  destinationQuery: unknown;
  destinationRanchoId?: unknown;
  message?: unknown;
}) {
  await expirePendingTransfers();
  const bovinoId = input.bovinoId == null || input.bovinoId === ""
    ? null
    : parseId(input.bovinoId, "bovino_id");
  const bovinoName = optionalText(input.bovinoName, 100);
  if (!bovinoId && !bovinoName) {
    return transferFailure(input, "bovino_required", "Indica el bovino que deseas transferir.");
  }

  const destinationQuery = optionalText(input.destinationQuery, 150);
  if (!destinationQuery) {
    return transferFailure(input, "destination_required", "Indica el nombre o correo del usuario destino.");
  }

  const destination = await resolveTransferUser(destinationQuery, input.sourceUserId);
  if (destination.status === "not_found") {
    return transferFailure(input, "user_not_found", `Usuario destino no encontrado: "${destinationQuery}".`, {
      matches: []
    });
  }
  if (destination.status === "ambiguous") {
    return transferFailure(input, "ambiguous_user", "Hay varios usuarios con ese nombre. Indica el correo exacto.", {
      matches: destination.matches
    });
  }
  if (destination.status === "self") {
    return transferFailure(input, "self_transfer", "No puedes transferir un bovino a tu propia cuenta.", {
      destination_user_id: destination.user.id
    });
  }

  const destinationRanchoId = optionalId(input.destinationRanchoId, "destination_rancho_id");
  const message = optionalText(input.message, 1000);
  const startedAt = Date.now();

  try {
    const outcome = await sql.begin(async (tx) => {
      const bovinos = bovinoId
        ? await tx`
            SELECT * FROM bovinos
            WHERE id = ${bovinoId} AND usuario_id = ${input.sourceUserId}
            FOR UPDATE
          `
        : await tx`
            SELECT * FROM bovinos
            WHERE usuario_id = ${input.sourceUserId}
              AND (LOWER(nombre) = LOWER(${bovinoName}) OR LOWER(numero_arete) = LOWER(${bovinoName}))
            LIMIT 2 FOR UPDATE
          `;
      const bovino = bovinos[0];
      if (!bovino) {
        return { ok: false as const, reason: "bovino_not_found" as const };
      }

      await ensureDestinationRancho(tx, destinationRanchoId, destination.user.id);

      const currentHistory = await tx`
        SELECT rancho_id FROM historial_propiedad
        WHERE bovino_id = ${bovino.id} AND fecha_fin IS NULL
        ORDER BY fecha_inicio DESC, id DESC LIMIT 1
      `;

      const rows = await tx`
        INSERT INTO bovino_transfers (
          bovino_id, source_user_id, destination_user_id,
          source_rancho_id, destination_rancho_id,
          status, message, source_arete
        ) VALUES (
          ${bovino.id}, ${input.sourceUserId}, ${destination.user.id},
          ${currentHistory[0]?.rancho_id ?? null}, ${destinationRanchoId},
          'PENDING', ${message}, ${bovino.numero_arete}
        )
        ON CONFLICT (bovino_id) WHERE status = 'PENDING'
        DO NOTHING
        RETURNING *
      `;
      const created = rows[0];
      if (!created) {
        const pending = await tx`
          SELECT id, destination_user_id, requested_at
          FROM bovino_transfers
          WHERE bovino_id = ${bovino.id} AND status = 'PENDING'
          LIMIT 1
        `;
        return {
          ok: false as const,
          reason: "pending_exists" as const,
          bovino,
          pending_transfer: pending[0] ?? null
        };
      }

      await tx`
        INSERT INTO bovino_transfer_events (
          transfer_id, bovino_id, actor_user_id, event_type,
          from_user_id, to_user_id, metadata
        ) VALUES (
          ${created.id}, ${bovino.id}, ${input.sourceUserId}, 'REQUESTED',
          ${input.sourceUserId}, ${destination.user.id},
          ${JSON.stringify({ message })}::jsonb
        )
      `;

      await tx`
        INSERT INTO notifications (
          user_id, actor_user_id, type, title, body,
          entity_type, entity_id, data
        ) VALUES (
          ${destination.user.id}, ${input.sourceUserId}, 'BOVINO_TRANSFER_REQUEST',
          'Nueva transferencia de bovino',
          ${`${bovino.nombre} fue enviado a tu cuenta para aceptacion.`},
          'bovino_transfer', ${String(created.id)},
          ${JSON.stringify({ transfer_id: Number(created.id), bovino_id: Number(bovino.id) })}::jsonb
        )
      `;

      await recordActivity({
        actorUserId: input.sourceUserId,
        action: "transfer.requested",
        entityType: "bovino_transfer",
        entityId: created.id,
        durationMs: Date.now() - startedAt,
        metadata: {
          bovino_id: Number(bovino.id),
          bovino_name: String(bovino.nombre),
          destination_user_id: destination.user.id,
          destination_query: destinationQuery,
          destination_match: destination.user.match_type
        },
        client: tx
      });

      return {
        ok: true as const,
        transfer: { ...created, bovino, destination: destination.user }
      };
    });

    if (!outcome.ok && outcome.reason === "bovino_not_found") {
      return transferFailure(input, "bovino_not_found", "Bovino no encontrado en tu cuenta.");
    }
    if (!outcome.ok && outcome.reason === "pending_exists") {
      return transferFailure(input, "pending_exists", "Ya existe una solicitud pendiente para este bovino.", {
        pending_transfer: outcome.pending_transfer,
        bovino: outcome.bovino
      });
    }

    return outcome;
  } catch (error: any) {
    await transferFailure(input, "internal_error", "No se pudo crear la solicitud de transferencia.", {
      validation_stage: "database_transaction",
      database_code: error?.code ?? null
    });
    throw error;
  }
}

export async function listBovinoTransfers(userId: number, direction?: unknown, status?: unknown) {
  await expirePendingTransfers();
  const requestedDirection = String(direction ?? "all").toLowerCase();
  const requestedStatus = String(status ?? "").toUpperCase();
  const allowedStatus = new Set<TransferStatus>(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"]);
  const statusFilter = allowedStatus.has(requestedStatus as TransferStatus) ? requestedStatus : "";

  return sql`
    SELECT
      t.*,
      b.nombre AS bovino_nombre,
      COALESCE(t.destination_arete, t.source_arete, b.numero_arete) AS numero_arete,
      su.nombre AS source_user_name,
      su.email AS source_user_email,
      du.nombre AS destination_user_name,
      du.email AS destination_user_email,
      sr.nombre AS source_rancho_name,
      dr.nombre AS destination_rancho_name,
      CASE WHEN t.source_user_id = ${userId} THEN 'sent' ELSE 'received' END AS direction
    FROM bovino_transfers t
    JOIN bovinos b ON b.id = t.bovino_id
    JOIN usuarios su ON su.id = t.source_user_id
    JOIN usuarios du ON du.id = t.destination_user_id
    LEFT JOIN ranchos sr ON sr.id = t.source_rancho_id
    LEFT JOIN ranchos dr ON dr.id = t.destination_rancho_id
    WHERE (t.source_user_id = ${userId} OR t.destination_user_id = ${userId})
      AND (${requestedDirection} = 'all'
        OR (${requestedDirection} = 'sent' AND t.source_user_id = ${userId})
        OR (${requestedDirection} = 'received' AND t.destination_user_id = ${userId}))
      AND (${statusFilter} = '' OR t.status = ${statusFilter})
    ORDER BY t.requested_at DESC
    LIMIT 200
  `;
}

async function remapAppliedVaccines(tx: any, bovinoId: number, sourceUserId: number, destinationUserId: number) {
  const sourceVaccines = await tx`
    SELECT DISTINCT v.id, v.nombre, v.descripcion
    FROM vacuna_aplicada va
    JOIN vacunas v ON v.id = va.vacuna_id
    WHERE va.bovino_id = ${bovinoId} AND v.usuario_id = ${sourceUserId}
  `;

  for (const vaccine of sourceVaccines) {
    const target = await tx`
      INSERT INTO vacunas (usuario_id, nombre, descripcion)
      VALUES (${destinationUserId}, ${vaccine.nombre}, ${vaccine.descripcion})
      ON CONFLICT (usuario_id, nombre)
      DO UPDATE SET descripcion = COALESCE(vacunas.descripcion, EXCLUDED.descripcion)
      RETURNING id
    `;
    await tx`
      UPDATE vacuna_aplicada
      SET vacuna_id = ${target[0].id}
      WHERE bovino_id = ${bovinoId} AND vacuna_id = ${vaccine.id}
    `;
  }
}

export async function acceptBovinoTransfer(userId: number, transferIdValue: unknown, destinationRanchoValue?: unknown) {
  await expirePendingTransfers();
  const transferId = parseId(transferIdValue, "transfer_id");
  const requestedRanchoId = optionalId(destinationRanchoValue, "destination_rancho_id");
  const startedAt = Date.now();

  const result = await sql.begin(async (tx) => {
    const rows = await tx`SELECT * FROM bovino_transfers WHERE id = ${transferId} FOR UPDATE`;
    const transfer = rows[0];
    if (!transfer || Number(transfer.destination_user_id) !== userId) {
      apiError({ statusCode: 404, code: "NOT_FOUND", message: "Transferencia no encontrada." });
    }
    if (transfer.status !== "PENDING") {
      apiError({ statusCode: 409, code: "INVALID_TRANSFER_STATUS", message: `La transferencia esta ${String(transfer.status).toLowerCase()}.` });
    }

    const bovinos = await tx`SELECT * FROM bovinos WHERE id = ${transfer.bovino_id} FOR UPDATE`;
    const bovino = bovinos[0];
    if (!bovino || Number(bovino.usuario_id) !== Number(transfer.source_user_id)) {
      apiError({ statusCode: 409, code: "OWNER_CHANGED", message: "El bovino ya no pertenece al usuario remitente." });
    }

    const destinationRanchoId = requestedRanchoId ?? transfer.destination_rancho_id ?? null;
    await ensureDestinationRancho(tx, destinationRanchoId, userId);
    const previousHistoryRows = await tx`
      SELECT dueno_id, rancho_id
      FROM historial_propiedad
      WHERE bovino_id = ${bovino.id} AND fecha_fin IS NULL
      ORDER BY fecha_inicio DESC NULLS LAST, id DESC
      LIMIT 1
    `;
    const previousHistory = previousHistoryRows[0] ?? null;
    const destinationOwnerIds = await getRanchoOwnerIds(tx, destinationRanchoId);

    let destinationArete = String(bovino.numero_arete);
    const conflict = await tx`
      SELECT id FROM bovinos
      WHERE usuario_id = ${userId} AND UPPER(numero_arete) = UPPER(${destinationArete})
      LIMIT 1
    `;
    if (conflict.length) {
      destinationArete = await generarSiguienteArete(tx, userId);
    }

    await remapAppliedVaccines(tx, Number(bovino.id), Number(transfer.source_user_id), userId);
    await tx`
      UPDATE memories SET usuario_id = ${userId}, updated_at = NOW()
      WHERE bovino_id = ${bovino.id} AND usuario_id = ${transfer.source_user_id}
    `;
    await tx`
      UPDATE historial_propiedad
      SET fecha_fin = CURRENT_DATE
      WHERE bovino_id = ${bovino.id} AND fecha_fin IS NULL
    `;
    await tx`
      UPDATE bovinos
      SET usuario_id = ${userId}, rancho_id = ${destinationRanchoId},
          numero_arete = ${destinationArete}, updated_at = NOW()
      WHERE id = ${bovino.id}
    `;
    await syncBovinoOwners({
      client: tx,
      userId,
      bovinoId: Number(bovino.id),
      duenoIds: destinationOwnerIds
    });
    await tx`
      INSERT INTO historial_propiedad (
        bovino_id, dueno_id, rancho_id, propietario_usuario_id,
        transfer_id, fecha_inicio, observaciones
      ) VALUES (
        ${bovino.id}, ${destinationOwnerIds[0] ?? null}, ${destinationRanchoId}, ${userId},
        ${transferId}, CURRENT_DATE,
        ${`Transferencia aceptada desde el usuario ${transfer.source_user_id}.`}
      )
    `;
    const accepted = await tx`
      UPDATE bovino_transfers
      SET status = 'ACCEPTED', responded_at = NOW(), updated_at = NOW(),
          destination_rancho_id = ${destinationRanchoId},
          destination_arete = ${destinationArete}
      WHERE id = ${transferId}
      RETURNING *
    `;
    await tx`
      INSERT INTO bovino_transfer_events (
        transfer_id, bovino_id, actor_user_id, event_type,
        from_user_id, to_user_id, metadata
      ) VALUES (
        ${transferId}, ${bovino.id}, ${userId}, 'ACCEPTED',
        ${transfer.source_user_id}, ${userId},
        ${JSON.stringify({
          source_arete: bovino.numero_arete,
          destination_arete: destinationArete,
          previous_rancho_id: previousHistory?.rancho_id ?? null,
          previous_dueno_id: previousHistory?.dueno_id ?? null,
          destination_rancho_id: destinationRanchoId,
          destination_dueno_ids: destinationOwnerIds
        })}::jsonb
      )
    `;
    await tx`
      INSERT INTO notifications (
        user_id, actor_user_id, type, title, body, entity_type, entity_id, data
      ) VALUES (
        ${transfer.source_user_id}, ${userId}, 'BOVINO_TRANSFER_ACCEPTED',
        'Transferencia aceptada',
        ${`${bovino.nombre} ya pertenece al usuario receptor.`},
        'bovino_transfer', ${String(transferId)},
        ${JSON.stringify({ transfer_id: transferId, bovino_id: Number(bovino.id) })}::jsonb
      )
    `;
    await recordActivity({
      actorUserId: userId,
      action: "transfer.accepted",
      entityType: "bovino_transfer",
      entityId: transferId,
      durationMs: Date.now() - startedAt,
      metadata: { bovino_id: Number(bovino.id), source_user_id: Number(transfer.source_user_id) },
      client: tx
    });

    return {
      transfer: accepted[0],
      bovino: {
        ...bovino,
        usuario_id: userId,
        rancho_id: destinationRanchoId,
        numero_arete: destinationArete,
        dueno_ids: destinationOwnerIds
      }
    };
  });

  await rebuildBovinoContext(Number(result.bovino.id));
  return result;
}

async function closeTransfer(input: {
  userId: number;
  transferId: unknown;
  status: "REJECTED" | "CANCELLED";
}) {
  await expirePendingTransfers();
  const transferId = parseId(input.transferId, "transfer_id");
  return sql.begin(async (tx) => {
    const rows = await tx`SELECT * FROM bovino_transfers WHERE id = ${transferId} FOR UPDATE`;
    const transfer = rows[0];
    const allowedUser = input.status === "REJECTED"
      ? Number(transfer?.destination_user_id) === input.userId
      : Number(transfer?.source_user_id) === input.userId;
    if (!transfer || !allowedUser) {
      apiError({ statusCode: 404, code: "NOT_FOUND", message: "Transferencia no encontrada." });
    }
    if (transfer.status !== "PENDING") {
      apiError({ statusCode: 409, code: "INVALID_TRANSFER_STATUS", message: "La transferencia ya no esta pendiente." });
    }

    const updated = await tx`
      UPDATE bovino_transfers
      SET status = ${input.status}, responded_at = NOW(), updated_at = NOW()
      WHERE id = ${transferId}
      RETURNING *
    `;
    await tx`
      INSERT INTO bovino_transfer_events (
        transfer_id, bovino_id, actor_user_id, event_type,
        from_user_id, to_user_id, metadata
      ) VALUES (
        ${transferId}, ${transfer.bovino_id}, ${input.userId}, ${input.status},
        ${transfer.source_user_id}, ${transfer.destination_user_id}, '{}'::jsonb
      )
    `;
    const notifyUserId = input.status === "REJECTED"
      ? Number(transfer.source_user_id)
      : Number(transfer.destination_user_id);
    await tx`
      INSERT INTO notifications (
        user_id, actor_user_id, type, title, body, entity_type, entity_id
      ) VALUES (
        ${notifyUserId}, ${input.userId}, ${`BOVINO_TRANSFER_${input.status}`},
        ${input.status === "REJECTED" ? "Transferencia rechazada" : "Transferencia cancelada"},
        ${`La solicitud de transferencia ${transferId} cambio a ${input.status}.`},
        'bovino_transfer', ${String(transferId)}
      )
    `;
    await recordActivity({
      actorUserId: input.userId,
      action: `transfer.${input.status.toLowerCase()}`,
      entityType: "bovino_transfer",
      entityId: transferId,
      client: tx
    });
    return updated[0];
  });
}

export const rejectBovinoTransfer = (userId: number, transferId: unknown) =>
  closeTransfer({ userId, transferId, status: "REJECTED" });

export const cancelBovinoTransfer = (userId: number, transferId: unknown) =>
  closeTransfer({ userId, transferId, status: "CANCELLED" });

export async function getBovinoOwnershipTimeline(userId: number, bovinoIdValue: unknown) {
  const bovinoId = parseId(bovinoIdValue, "bovino_id");
  const access = await sql`
    SELECT id FROM bovinos WHERE id = ${bovinoId} AND usuario_id = ${userId}
    UNION
    SELECT bovino_id AS id FROM bovino_transfers
    WHERE bovino_id = ${bovinoId}
      AND (source_user_id = ${userId} OR destination_user_id = ${userId})
    LIMIT 1
  `;
  if (!access.length) {
    apiError({ statusCode: 404, code: "NOT_FOUND", message: "Historial no encontrado." });
  }

  return sql`
    SELECT
      e.id, e.event_type, e.created_at, e.metadata,
      fu.nombre AS from_user_name, fu.email AS from_user_email,
      tu.nombre AS to_user_name, tu.email AS to_user_email,
      au.nombre AS actor_name,
      t.status, t.source_arete, t.destination_arete
    FROM bovino_transfer_events e
    JOIN bovino_transfers t ON t.id = e.transfer_id
    LEFT JOIN usuarios fu ON fu.id = e.from_user_id
    LEFT JOIN usuarios tu ON tu.id = e.to_user_id
    LEFT JOIN usuarios au ON au.id = e.actor_user_id
    WHERE e.bovino_id = ${bovinoId}
    ORDER BY e.created_at ASC, e.id ASC
  `;
}
