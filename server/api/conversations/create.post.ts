import { randomUUID } from "crypto";
import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export default defineEventHandler(async (event) => {

  const body =
    await readBody(event);

  const conversationId =
    randomUUID();

  await sql`

    INSERT INTO conversations (

      id,
      usuario_id

    )

    VALUES (

      ${conversationId},
      ${body.usuario_id}

    )

  `;

  return {

    conversation_id:
      conversationId

  };

});