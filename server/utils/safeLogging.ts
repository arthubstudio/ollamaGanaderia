type ErrorLike = {
  name?: unknown;
  code?: unknown;
  statusCode?: unknown;
  statusMessage?: unknown;
  data?: any;
};

function cleanLabel(value: unknown, fallback: string, maxLength = 80) {
  const label = String(value ?? "")
    .replace(/[^a-zA-Z0-9_.:-]/g, "")
    .slice(0, maxLength);
  return label || fallback;
}

function errorData(error: ErrorLike) {
  if (error?.data?.data && typeof error.data.data === "object") return error.data.data;
  return error?.data && typeof error.data === "object" ? error.data : null;
}

export function safeErrorDetails(error: unknown) {
  const value = (error && typeof error === "object" ? error : {}) as ErrorLike;
  const data = errorData(value);
  return {
    error_type: cleanLabel(value.name, "Error"),
    error_code: cleanLabel(data?.code ?? value.code, "UNCLASSIFIED_ERROR"),
    status_code: Number.isInteger(Number(value.statusCode))
      ? Number(value.statusCode)
      : 500
  };
}

export function safePublicErrorMessage(error: unknown, fallback: string) {
  const value = (error && typeof error === "object" ? error : {}) as ErrorLike;
  const statusCode = Number(value.statusCode ?? 500);
  const data = errorData(value);
  if (statusCode < 400 || statusCode >= 500 || typeof data?.code !== "string") {
    return fallback;
  }

  const candidate = data?.message ?? value.statusMessage;
  if (typeof candidate !== "string") return fallback;
  const message = candidate.replace(/[\r\n\t]+/g, " ").trim().slice(0, 500);
  return message || fallback;
}
