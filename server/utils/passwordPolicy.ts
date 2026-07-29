import { apiError } from "~/server/utils/api";

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

const BLOCKED_PASSWORDS = new Set([
  "123456",
  "12345678",
  "123456789",
  "password",
  "password123",
  "contrasena",
  "contrasena123",
  "qwerty123",
  "admin123",
  "ganaderia",
  "ganaderia123"
]);

export function isStrongPassword(password: string, identityValues: string[] = []) {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }

  const normalized = password.toLowerCase().replace(/\s+/g, "");
  if (BLOCKED_PASSWORDS.has(normalized)) return false;
  if (/^(.)\1+$/.test(normalized)) return false;

  return !identityValues
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length >= 4)
    .some((value) => normalized.includes(value.replace(/\s+/g, "")));
}

export function assertStrongPassword(password: string, identityValues: string[] = []) {
  if (!isStrongPassword(password, identityValues)) {
    apiError({
      statusCode: 400,
      code: "WEAK_PASSWORD",
      message: "Usa una contrasena o frase de al menos 12 caracteres que no contenga tu nombre o correo."
    });
  }
}
