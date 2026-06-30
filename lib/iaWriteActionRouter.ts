import { normalizeRouterText } from "~/lib/bovinoRouterHelpers";
import {
  isCreateOnlyCatalog,
  isDeleteAction,
  isReadQuery,
  isUnassignAction,
  isUpdateAction,
  needsBovinoAssignment,
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
  return /\b(aplica|aplicar|aplicale|aplicarle|registra|registrar|agrega|agregar|anade|anadir|asigna|asignar|asignale|asignarle|transfiere|transferir|transferirle|transfierelo|transfierela|ponle|anota|anotar|crea|crear|cree|elimina|eliminar|borra|borrar|actualiza|actualizar|modifica|modificar|quita|quitar|designa|designar)\b/.test(
    text
  );
}

function extractBovinoFromQuestion(
  pregunta: string,
  nombreAnimalContexto?: string | null
) {
  const contextMatch = pregunta.match(/\(sobre el bovino\s+([^)]+)\)/i);
  if (contextMatch?.[1]?.trim()) return contextMatch[1].trim();
  if (nombreAnimalContexto?.trim()) return nombreAnimalContexto.trim();

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
  if (!parsed?.numero_arete || !parsed.nombre || !parsed.raza || !parsed.sexo) {
    return null;
  }

  return {
    tool: "crearBovino",
    args: {
      numero_arete: parsed.numero_arete,
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
    return { tool: "crearDueno", args: { nombre } };
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

export function inferTransferirPropiedad(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredAction | null {
  if (isCreateOnlyCatalog(pregunta)) return null;
  if (!needsBovinoAssignment(pregunta)) return null;

  const t = normalizeIntentText(pregunta);

  const dueno_nombre =
    extractQuotedOrNamed(pregunta, "(?:dueno|dueño)") ??
    extractTokenAfter(t, /(?:dueno|dueño)\s+(?:llamado\s+|de\s+nombre\s+)?([a-z0-9][a-z0-9 _-]{0,40})/i);

  const rancho_nombre =
    extractQuotedOrNamed(pregunta, "rancho") ??
    extractTokenAfter(t, /\brancho\s+(?:llamado\s+|de\s+nombre\s+)?([a-z0-9][a-z0-9 _-]{0,40})/i);

  if (!dueno_nombre && !rancho_nombre) return null;

  const nombre_vaca = extractBovinoFromQuestion(pregunta, nombreAnimalContexto);
  if (!nombre_vaca) return null;

  return {
    tool: "transferirPropiedad",
    args: {
      nombre_vaca,
      dueno_nombre: dueno_nombre ?? undefined,
      rancho_nombre: rancho_nombre ?? undefined
    }
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
    inferCrearBovino(pregunta) ??
    inferCrearCatalogo(pregunta) ??
    inferDeleteAction(pregunta, nombreAnimalContexto) ??
    inferUpdateAction(pregunta, nombreAnimalContexto) ??
    inferUnassignAction(pregunta, nombreAnimalContexto) ??
    inferRegistrarEnfermedad(pregunta, nombreAnimalContexto) ??
    inferAplicarVacuna(pregunta, nombreAnimalContexto) ??
    inferTransferirPropiedad(pregunta, nombreAnimalContexto)
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
