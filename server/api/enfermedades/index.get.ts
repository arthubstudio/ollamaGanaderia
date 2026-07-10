import { sql } from "~/lib/db";
import { parseId, runApi } from "~/server/utils/api";
import { requireOwnedBovino } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const bovinoId = parseId(getQuery(event).bovino_id, "bovino_id");
  await requireOwnedBovino(bovinoId, userId);
  return sql`SELECT * FROM enfermedades WHERE bovino_id = ${bovinoId} ORDER BY fecha DESC NULLS LAST, id DESC`;
}));
