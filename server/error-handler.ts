import {
  send,
  setResponseHeader,
  setResponseStatus,
  type H3Event
} from "h3";

export default async function handleNitroError(error: any, event: H3Event) {
  const statusCode = Number(error?.statusCode ?? 500);
  const isApi = String(event.path ?? "").startsWith("/api/");
  const fallbackMessage = statusCode >= 500
    ? "La operacion fallo por un error interno. Consulta el registro del servidor con el codigo INTERNAL_ERROR."
    : "La solicitud fue rechazada por una validacion del servidor.";
  const message = String(error?.data?.message ?? error?.statusMessage ?? fallbackMessage);
  const code = String(error?.data?.code ?? (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"));

  setResponseStatus(event, statusCode);

  if (isApi) {
    setResponseHeader(event, "Content-Type", "application/json; charset=utf-8");
    return send(event, JSON.stringify({ success: false, code, message }));
  }

  setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
  return send(event, message);
}
