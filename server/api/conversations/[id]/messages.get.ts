import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export default defineEventHandler(async (event) => {
  const conversationId = event.context.params?.id;

  if (!conversationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Falta conversation id"
    });
  }

  const rows = await sql`
    SELECT
      role,
      content,
      created_at
    FROM conversation_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY id ASC
    LIMIT 100
  `;

  return rows;
});
