export const DEFAULT_IA_ERROR =
  "El servidor de IA termino sin devolver una respuesta. Revisa el registro de la operacion e intenta nuevamente.";

export function normalizeIaAnswer(value: unknown, fallback = DEFAULT_IA_ERROR) {
  if (typeof value === "string" && value.trim()) return value.trim();

  if (value && typeof value === "object") {
    const response = value as Record<string, unknown>;
    for (const key of ["answer", "respuesta", "message", "mensaje"]) {
      const candidate = response[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return fallback;
}

export function withIaAnswer<T extends Record<string, unknown>>(
  response: T,
  fallback = DEFAULT_IA_ERROR
) {
  const answer = normalizeIaAnswer(response, fallback);
  return {
    ...response,
    answer,
    // Se conserva durante la transicion para no romper consumidores anteriores.
    respuesta: answer
  };
}
