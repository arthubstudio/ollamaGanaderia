import { clearUserSession } from "~/server/utils/session";

export default defineEventHandler((event) => {
  clearUserSession(event);
  return { success: true };
});
