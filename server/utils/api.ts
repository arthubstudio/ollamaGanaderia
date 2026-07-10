import { createError } from "h3";

type ApiErrorOptions = {
  statusCode: number;
  code: string;
  message: string;
};

export function apiError({ statusCode, code, message }: ApiErrorOptions): never {
  throw createError({
    statusCode,
    statusMessage: message,
    data: { success: false, code, message }
  });
}

export function parseId(value: unknown, field = "id") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    apiError({
      statusCode: 400,
      code: "INVALID_ID",
      message: `El campo ${field} no es valido.`
    });
  }
  return id;
}

export function requiredText(value: unknown, field: string, maxLength = 100) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    apiError({
      statusCode: 400,
      code: "REQUIRED_FIELD",
      message: `El campo ${field} es obligatorio.`
    });
  }
  if (text.length > maxLength) {
    apiError({
      statusCode: 400,
      code: "FIELD_TOO_LONG",
      message: `El campo ${field} supera ${maxLength} caracteres.`
    });
  }
  return text;
}

export function optionalText(value: unknown, maxLength = 5000) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    apiError({
      statusCode: 400,
      code: "INVALID_TEXT",
      message: "El valor de texto no es valido."
    });
  }
  const text = value.trim();
  if (!text) return null;
  if (text.length > maxLength) {
    apiError({
      statusCode: 400,
      code: "FIELD_TOO_LONG",
      message: `El texto supera ${maxLength} caracteres.`
    });
  }
  return text;
}

export function optionalDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    apiError({ statusCode: 400, code: "INVALID_DATE", message: `${field} no es valida.` });
  }
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    apiError({ statusCode: 400, code: "INVALID_DATE", message: `${field} no es valida.` });
  }
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    apiError({ statusCode: 400, code: "INVALID_DATE", message: `${field} no es valida.` });
  }
  return text;
}

export function requiredDate(value: unknown, field: string) {
  const date = optionalDate(value, field);
  if (!date) {
    apiError({ statusCode: 400, code: "REQUIRED_DATE", message: `${field} es obligatoria.` });
  }
  return date;
}

export function positiveNumber(value: unknown, field: string) {
  if (value === "" || value === null || value === undefined) {
    apiError({ statusCode: 400, code: "INVALID_NUMBER", message: `${field} no es valido.` });
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    apiError({ statusCode: 400, code: "INVALID_NUMBER", message: `${field} no es valido.` });
  }
  return number;
}

export function optionalId(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return parseId(value, field);
}

export async function runApi<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error: any) {
    if (error?.statusCode) throw error;

    console.error("API operation failed", error);

    if (error?.code === "23505") {
      apiError({ statusCode: 409, code: "DUPLICATE", message: "Ya existe un registro con esos datos." });
    }
    if (error?.code === "23503") {
      apiError({ statusCode: 409, code: "RELATED_RECORDS", message: "El registro tiene relaciones activas o relacionadas." });
    }
    if (error?.code === "22P02" || error?.code === "22007") {
      apiError({ statusCode: 400, code: "INVALID_VALUE", message: "Uno de los valores no es valido." });
    }

    apiError({
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: "No se pudo completar la operacion."
    });
  }
}
