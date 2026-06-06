import postgres from "postgres";

export default defineEventHandler(async () => {

  const sql = postgres(
    "postgres://admin:admin123@127.0.0.1:5432/ganaderia_ai",
    {
      prepare: false
    }
  );

  const result = await sql`SELECT NOW()`;

  return result;

});