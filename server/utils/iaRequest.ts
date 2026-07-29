import { apiError, requiredText } from "~/server/utils/api";

export const MAX_IA_QUESTION_LENGTH = 4096;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseConversationId(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    apiError({
      statusCode: 400,
      code: "INVALID_CONVERSATION_ID",
      message: "conversation_id debe ser un UUID valido."
    });
  }

  if (value === "") return null;
  const conversationId = value.trim();
  if (!UUID_PATTERN.test(conversationId)) {
    apiError({
      statusCode: 400,
      code: "INVALID_CONVERSATION_ID",
      message: "conversation_id debe ser un UUID valido."
    });
  }

  return conversationId.toLowerCase();
}

export function parseIaMessage(
  body: unknown,
  options: {
    field?: "pregunta" | "message";
    allowStream?: boolean;
  } = {}
) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    apiError({
      statusCode: 400,
      code: "INVALID_BODY",
      message: "El cuerpo de la solicitud debe ser un objeto JSON."
    });
  }

  const record = body as Record<string, unknown>;
  const field = options.field ?? "pregunta";
  const message = requiredText(
    record[field],
    field,
    MAX_IA_QUESTION_LENGTH
  );
  const conversationId = parseConversationId(record.conversation_id);

  if (
    options.allowStream &&
    record.stream !== undefined &&
    typeof record.stream !== "boolean"
  ) {
    apiError({
      statusCode: 400,
      code: "INVALID_STREAM",
      message: "stream debe ser un valor booleano."
    });
  }

  return {
    message,
    conversationId,
    stream: options.allowStream ? Boolean(record.stream) : false
  };
}
