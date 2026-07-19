import { sql } from "~/lib/db";
import { updateBreed } from "~/server/services/breedService";
import { recordActivity } from "~/server/services/activityAudit";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const users = await sql`SELECT rol FROM usuarios WHERE id = ${userId}`;
  const breed = await updateBreed({
    userId,
    userRole: users[0]?.rol,
    id: event.context.params?.id,
    body: body ?? {}
  });
  await recordActivity({ actorUserId: userId, action: "breed.updated", entityType: "breed", entityId: breed.id });
  return breed;
}));

