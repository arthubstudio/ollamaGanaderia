import { normalizeRouterText } from "~/lib/bovinoRouterHelpers";
import {
  isCreateOnlyCatalog,
  isDeleteAction,
  isReadQuery,
  isUnassignAction,
  isUpdateAction,
  normalizeIntentText
} from "~/lib/iaIntentRouter";
import { parseBovinoFieldsFromText } from "~/lib/bovinoFieldParser";

const STOPWORDS = new Set([
  "la", "el", "los", "las", "de", "del", "y", "o", "a", "al", "en",
  "que", "se", "su", "sus", "un", "una", "con", "por", "para", "le",
  "lo", "es", "son", "si", "no", "ya", "sobre", "bovino", "vaca", "toro",
  "tiene", "tienen", "puesta", "puestas", "aplicada", "aplicadas",
  "registrada", "registradas", "llamado", "llamada", "nuevo", "nueva"
]);

export type InferredAction = {
  tool: string;
  args: Record<string, unknown>;
};

function hasWriteVerb(text: string) {
  return /\b(aplica|aplicar|aplicale|aplicarle|registra|registrar|registrale|agrega|agregar|agregale|anade|anadir|asigna|asignar|asignale|asignarle|transfiere|transfiera|transferir|transferirle|transfierelo|transfierela|envia|enviar|manda|mandar|pasa|pasar|traspasa|traspasar|ponle|anota|anotar|anotale|crea|crear|cree|elimina|eliminar|borra|borrar|actualiza|actualizar|actualizale|modifica|modificar|quita|quitar|designa|designar)\b/.test(
    text
  );
}

function extractBovinoFromQuestion(
  pregunta: string,
  nombreAnimalContexto?: string | null
) {
  const contextMatch = pregunta.match(/\(sobre el bovino\s+([^)]+)\)/i);
  if (contextMatch?.[1]?.trim()) return contextMatch[1].trim();
  const patterns = [
    /\b(?:de la|del|de)\s+(?:vaca|bovino|toro)\s+([a-z0-9_-]+)/i,
    /\b(?:a|al|para)\s+(?:la\s+)?(?:vaca|bovino|toro)\s+([a-z0-9_-]+)/i,
    /\b(?:vaca|bovino|toro)\s+([a-z0-9_-]+)/i
  ];

  for (const pattern of patterns) {
    const match = pregunta.match(pattern);
    const token = match?.[1]?.trim();
    if (token && !STOPWORDS.has(normalizeRouterText(token))) return token;
  }

  if (nombreAnimalContexto?.trim()) return nombreAnimalContexto.trim();

  return "";
}

function extractQuotedOrNamed(
  text: string,
  entityPattern: string
): string | null {
  const quoted = text.match(
    new RegExp(`${entityPattern}\\s+(?:llamad[oa]|de nombre)?\\s*["“]([^"”]+)["”]`, "i")
  );
  if (quoted?.[1]?.trim()) return quoted[1].trim();

  const named = text.match(
    new RegExp(`${entityPattern}\\s+(?:llamad[oa]|de nombre)\\s+([a-z0-9][a-z0-9 _-]{1,40})`, "i")
  );
  if (named?.[1]?.trim()) return named[1].trim();

  return null;
}

function extractTokenAfter(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  const token = match?.[1]?.trim();
  if (!token) return null;
  if (STOPWORDS.has(normalizeRouterText(token.split(/\s+/)[0] ?? ""))) return null;
  return token;
}

function extractTransferDestination(text: string) {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (email) return email.toLowerCase();

  const explicitUser = text.match(
    /(?:al\s+usuario|a\s+la\s+usuaria|usuario|usuaria)\s+([A-Za-z0-9 _.-]+?)\s*[.!?]?$/i
  );
  if (explicitUser?.[1]?.trim()) return explicitUser[1].trim();

  const trailingTarget = text.match(
    /(?:\ba|\bhacia)\s+(?:la\s+cuenta\s+de\s+|el\s+usuario\s+|la\s+usuaria\s+)?([A-Za-z0-9._-]+(?:\s+[A-Za-z0-9._-]+){0,3})\s*[.!?]?$/i
  );
  return trailingTarget?.[1]?.trim() ?? "";
}

export function inferCrearSolicitudTransferencia(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredAction | null {
  const t = normalizeIntentText(pregunta);
  if (!/\b(transfiere|transfiera|transferir|envia|enviar|manda|mandar|pasa|pasar|traspasa|traspasar)\b/.test(t)) {
    return null;
  }
  if (/\bmensaje\b/.test(t)) return null;
  if (!/\b(bovino|vaca|toro)\b/.test(t) && !nombreAnimalContexto) return null;

  const nombre_bovino = extractBovinoFromQuestion(pregunta, nombreAnimalContexto);
  const usuario_destino = extractTransferDestination(pregunta);
  if (!nombre_bovino || !usuario_destino) return null;

  return {
    tool: "crearSolicitudTransferencia",
    args: { nombre_bovino, usuario_destino }
  };
}

export function inferReadAction(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredAction | null {
  if (!isReadQuery(pregunta)) return null;

  const t = normalizeIntentText(pregunta);
  const nombre =
    extractBovinoFromQuestion(pregunta, nombreAnimalContexto) ||
    nombreAnimalContexto ||
    "";

  if (/\b(vacuna|vacunas)\b/.test(t) && nombre) {
    return { tool: "getVacunas", args: { nombre } };
  }

  if (/\b(enfermedad|enfermedades)\b/.test(t) && nombre) {
    return { tool: "getEnfermedades", args: { nombre } };
  }

  if (/\b(peso|pesa|pesos)\b/.test(t) && nombre) {
    return { tool: "getPeso", args: { nombre } };
  }

  if (/\b(edad|nacimiento|años|anos)\b/.test(t) && nombre) {
    return { tool: "getEdad", args: { nombre } };
  }

  if (/\b(historial|propiedad|dueno|dueño|rancho)\b/.test(t) && nombre) {
    return { tool: "getHistorial", args: { nombre } };
  }

  if (/\b(venta|vendida|vendido|comprador)\b/.test(t) && nombre) {
    return { tool: "getVenta", args: { nombre } };
  }

  if (/\b(estado|activa|activo|baja)\b/.test(t) && nombre) {
    return { tool: "getEstado", args: { nombre } };
  }

  if (nombre && (/\b(resumen|informacion|información|datos|ficha)\b/.test(t) || t.split(" ").length <= 4)) {
    return { tool: "getResumen", args: { nombre } };
  }

  return null;
}

export function inferCrearBovino(pregunta: string): InferredAction | null {
  const parsed = parseBovinoFieldsFromText(pregunta);
  if (!parsed?.nombre || !parsed.raza || !parsed.sexo) {
    return null;
  }

  return {
    tool: "crearBovino",
    args: {
      nombre: parsed.nombre,
      raza: parsed.raza,
      sexo: parsed.sexo
    }
  };
}

export function inferCrearCatalogo(pregunta: string): InferredAction | null {
  if (!isCreateOnlyCatalog(pregunta)) return null;

  const t = normalizeIntentText(pregunta);

  if (/\b(dueno|dueño)\b/.test(t)) {
    const nombre =
      extractQuotedOrNamed(pregunta, "(?:un\\s+)?(?:dueno|dueño)") ??
      extractTokenAfter(t, /(?:dueno|dueño)\s+(?:llamado\s+|de nombre\s+)?([a-z0-9][a-z0-9 _-]{0,40})/i);

    if (!nombre) return null;
    return null;
  }

  if (/\brancho/.test(t)) {
    const nombre =
      extractQuotedOrNamed(pregunta, "(?:un\\s+)?(?:nuevo\\s+)?rancho") ??
      extractTokenAfter(
        t,
        /(?:rancho)\s+(?:llamado\s+|de nombre\s+|denominado\s+)?([a-z0-9][a-z0-9 _-]{0,40})/i
      );

    if (!nombre) return null;
    return { tool: "crearRancho", args: { nombre } };
  }

  if (/\bvacuna/.test(t)) {
    const nombre =
      extractQuotedOrNamed(pregunta, "(?:una\\s+)?vacuna") ??
      extractTokenAfter(t, /(?:vacuna)\s+(?:llamada\s+|de nombre\s+)?([a-z0-9][a-z0-9 _-]{0,40})/i);

    if (!nombre) return null;
    return { tool: "crearVacuna", args: { nombre } };
  }

  return null;
}

export function inferRegistrarPeso(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredAction | null {
  const t = normalizeIntentText(pregunta);
  if (!/\b(peso|pesa|kg|kilo|kilos)\b/.test(t) || isReadQuery(pregunta)) return null;
  if (!hasWriteVerb(t)) return null;

  const pesoText = pregunta.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?)?(?:\s+de\s+peso)?/i)?.[1];
  const peso = Number(String(pesoText ?? "").replace(",", "."));
  if (!Number.isFinite(peso) || peso <= 0) return null;

  const explicitTrailing = pregunta.match(
    /(?:peso\s+(?:a|al|para)|(?:kg|kilos?)\s+(?:de\s+peso\s+)?(?:a|al|para))\s+(?:el\s+|la\s+)?(?:bovino\s+|vaca\s+|toro\s+)?([A-Za-zÁÉÍÓÚáéíóúÑñ0-9_-]+)[.!?]?$/i
  )?.[1];
  const nombre = extractBovinoFromQuestion(pregunta) || explicitTrailing || nombreAnimalContexto || "";
  if (!nombre) return null;

  return { tool: "registrarPeso", args: { nombre, peso } };
}

export function inferRegistrarEnfermedad(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredAction | null {
  const t = normalizeIntentText(pregunta);
  if (!/\benfermedad/.test(t) || /\bvacuna/.test(t)) return null;
  if (isReadQuery(pregunta)) return null;
  if (!hasWriteVerb(t) && !/\b(enfermedad)\s+[a-z0-9]/i.test(pregunta)) return null;

  const enfermedad =
    extractQuotedOrNamed(pregunta, "enfermedad") ??
    extractTokenAfter(t, /\benfermedad\s+(?:llamada\s+|de\s+nombre\s+)?([a-z0-9_-]+)/i);

  if (!enfermedad) return null;

  const nombre = extractBovinoFromQuestion(pregunta, nombreAnimalContexto);
  if (!nombre) return null;

  return {
    tool: "registrarEnfermedad",
    args: { nombre_vaca: nombre, enfermedad }
  };
}

export function inferAplicarVacuna(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredAction | null {
  const t = normalizeIntentText(pregunta);
  if (/\benfermedad/.test(t) || isReadQuery(pregunta)) return null;
  if (!/\bvacuna/.test(t)) return null;
  if (!hasWriteVerb(t)) return null;

  const vacuna_nombre =
    extractQuotedOrNamed(pregunta, "vacuna") ??
    extractTokenAfter(t, /\bvacuna\s+(?:llamada\s+|de\s+nombre\s+)?([a-z0-9_-]+)/i);

  if (!vacuna_nombre) return null;

  const nombre_vaca = extractBovinoFromQuestion(pregunta, nombreAnimalContexto);
  if (!nombre_vaca) return null;

  return {
    tool: "aplicarVacuna",
    args: { nombre_vaca, vacuna_nombre }
  };
}

export function inferDeleteAction(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredAction | null {
  if (!isDeleteAction(pregunta)) return null;

  const t = normalizeIntentText(pregunta);
  const nombre = extractBovinoFromQuestion(pregunta, nombreAnimalContexto);

  if (/\b(vaca|vacas|bovino|bovinos|toro|toros)\b/.test(t) && nombre) {
    return { tool: "eliminarBovino", args: { nombre } };
  }

  if (/\b(enfermedad|enfermedades)\b/.test(t)) {
    const enfermedad =
      extractQuotedOrNamed(pregunta, "enfermedad") ??
      extractTokenAfter(t, /\benfermedad\s+([a-z0-9 _-]+)/i);
    if (nombre && enfermedad) {
      return { tool: "eliminarEnfermedad", args: { nombre_vaca: nombre, enfermedad } };
    }
  }

  if (/\b(vacuna|vacunas)\b/.test(t) && /\b(aplicad|puesta|asignad|de la vaca|del bovino)\b/.test(t)) {
    const vacuna_nombre =
      extractQuotedOrNamed(pregunta, "vacuna") ??
      extractTokenAfter(t, /\bvacuna\s+([a-z0-9 _-]+)/i);
    if (nombre && vacuna_nombre) {
      return { tool: "eliminarVacunaAplicada", args: { nombre_vaca: nombre, vacuna_nombre } };
    }
  }

  if (/\b(vacuna|vacunas)\b/.test(t) && !/\b(vaca|bovino|toro)\b/.test(t)) {
    const vacuna_nombre =
      extractQuotedOrNamed(pregunta, "vacuna") ??
      extractTokenAfter(t, /\bvacuna\s+([a-z0-9 _-]+)/i);
    if (vacuna_nombre) return { tool: "eliminarVacuna", args: { nombre: vacuna_nombre } };
  }

  if (/\b(dueno|dueño)\b/.test(t) && !/\b(vaca|bovino|toro)\b/.test(t)) {
    const dueno_nombre =
      extractQuotedOrNamed(pregunta, "(?:dueno|dueño)") ??
      extractTokenAfter(t, /(?:dueno|dueño)\s+([a-z0-9 _-]+)/i);
    if (dueno_nombre) return { tool: "eliminarDueno", args: { nombre: dueno_nombre } };
  }

  if (/\brancho/.test(t) && !/\b(vaca|bovino|toro)\b/.test(t)) {
    const rancho_nombre =
      extractQuotedOrNamed(pregunta, "rancho") ??
      extractTokenAfter(t, /\brancho\s+([a-z0-9 _-]+)/i);
    if (rancho_nombre) return { tool: "eliminarRancho", args: { nombre: rancho_nombre } };
  }

  return null;
}

export function inferUpdateAction(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredAction | null {
  if (!isUpdateAction(pregunta)) return null;

  const t = normalizeIntentText(pregunta);
  const nombre = extractBovinoFromQuestion(pregunta, nombreAnimalContexto);

  if (/\b(vaca|vacas|bovino|bovinos|toro|toros)\b/.test(t) && nombre) {
    const args: Record<string, string> = { nombre };
    const nuevoNombre = extractTokenAfter(t, /(?:renombrar|cambiar nombre|nuevo nombre)\s+(?:a\s+)?([a-z0-9 _-]+)/i);
    const arete = extractTokenAfter(t, /(?:arete)\s+(?:a\s+)?([a-z0-9_-]+)/i);
    const raza = extractTokenAfter(t, /(?:raza)\s+(?:a\s+)?([a-z0-9 _-]+)/i);
    if (nuevoNombre) args.nuevo_nombre = nuevoNombre;
    if (arete) args.numero_arete = arete;
    if (raza) args.raza = raza;
    if (Object.keys(args).length > 1) return { tool: "actualizarBovino", args };
  }

  if (/\b(enfermedad|enfermedades)\b/.test(t) && nombre) {
    const enfermedad = extractTokenAfter(t, /\benfermedad\s+([a-z0-9 _-]+)/i);
    const tratamiento = extractTokenAfter(t, /tratamiento\s+(?:a\s+)?([a-z0-9 _-]+)/i);
    if (enfermedad) {
      return {
        tool: "actualizarEnfermedad",
        args: {
          nombre_vaca: nombre,
          enfermedad,
          tratamiento: tratamiento ?? undefined
        }
      };
    }
  }

  return null;
}

export function inferUnassignAction(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredAction | null {
  if (!isUnassignAction(pregunta)) return null;

  const t = normalizeIntentText(pregunta);
  const nombre = extractBovinoFromQuestion(pregunta, nombreAnimalContexto);
  if (!nombre) return null;

  const quitarRancho = /\brancho/.test(t);
  const quitarDueno = /\b(dueno|dueño)\b/.test(t);

  return {
    tool: "quitarPropiedad",
    args: {
      nombre_vaca: nombre,
      quitar_rancho: quitarRancho || !quitarDueno,
      quitar_dueno: quitarDueno || !quitarRancho
    }
  };
}

export function inferActionFromQuestion(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredAction | null {
  return (
    inferReadAction(pregunta, nombreAnimalContexto) ??
    inferCrearSolicitudTransferencia(pregunta, nombreAnimalContexto) ??
    inferRegistrarPeso(pregunta, nombreAnimalContexto) ??
    inferCrearBovino(pregunta) ??
    inferCrearCatalogo(pregunta) ??
    inferDeleteAction(pregunta, nombreAnimalContexto) ??
    inferUpdateAction(pregunta, nombreAnimalContexto) ??
    inferUnassignAction(pregunta, nombreAnimalContexto) ??
    inferRegistrarEnfermedad(pregunta, nombreAnimalContexto) ??
    inferAplicarVacuna(pregunta, nombreAnimalContexto)
  );
}

/** @deprecated use inferActionFromQuestion */
export function inferWriteActionFromQuestion(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredAction | null {
  const action = inferActionFromQuestion(pregunta, nombreAnimalContexto);
  if (!action) return null;
  if (action.tool.startsWith("get")) return null;
  return action;
}
