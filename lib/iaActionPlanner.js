const STOP_ENTITY_WORDS = new Set([
  "tengo", "hay", "registrado", "registrados", "registrada", "registradas",
  "existe", "existen", "cuantos", "cuantas", "cuales", "cual", "catalogo",
  "muestrame", "muestre", "mostrar", "lista", "listar", "mis", "mi",
  "bovinos", "bovino", "vacas", "vaca", "toros", "toro", "vacunas",
  "vacuna", "ranchos", "rancho", "duenos", "dueno", "dueños", "dueño"
]);

const TOOL_LABELS = {
  crearBovino: "registrar el bovino",
  crearVacuna: "crear la vacuna",
  aplicarVacuna: "aplicar la vacuna",
  registrarPeso: "registrar el peso",
  registrarEnfermedad: "registrar la enfermedad",
  crearDueno: "crear el dueno",
  crearRancho: "crear el rancho",
  transferirPropiedad: "transferir la propiedad",
  eliminarBovino: "eliminar el bovino",
  eliminarVacuna: "eliminar la vacuna",
  eliminarDueno: "eliminar el dueno",
  eliminarRancho: "eliminar el rancho"
};

const REQUIRED = {
  crearBovino: ["nombre", "sexo", "raza"],
  crearVacuna: ["nombre"],
  crearDueno: ["nombre"],
  crearRancho: ["nombre"],
  aplicarVacuna: ["nombre_vaca", "vacuna_nombre"],
  registrarPeso: ["nombre", "peso"],
  registrarEnfermedad: ["nombre_vaca", "enfermedad"],
  eliminarBovino: ["nombre"],
  eliminarVacuna: ["nombre"],
  eliminarDueno: ["nombre"],
  eliminarRancho: ["nombre"]
};

const WRITE_TOOLS = new Set([
  "crearBovino",
  "crearVacuna",
  "crearDueno",
  "crearRancho",
  "aplicarVacuna",
  "registrarPeso",
  "registrarEnfermedad",
  "eliminarBovino",
  "eliminarVacuna",
  "eliminarDueno",
  "eliminarRancho",
  "transferirPropiedad",
  "quitarPropiedad",
  "eliminarVacunaAplicada"
]);

import { extractBovinoEntities } from "./bovinoEntityExtractor.js";

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function cleanValue(value) {
  return String(value ?? "")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

function hasAny(t, words) {
  return words.some((word) => t.includes(word));
}

function isCancel(text) {
  const t = normalizeText(text);
  return /\b(cancela|cancelar|olvida|deten|detener|ya no)\b/.test(t);
}

function isConfirmation(text) {
  const t = normalizeText(text);
  return /^(si|sí|confirmo|correcto|adelante|hazlo|dale|de acuerdo|ok|okay)\b/.test(t);
}

function isRejection(text) {
  const t = normalizeText(text);
  return /^(no|negativo|cancela|cancelar|mejor no)\b/.test(t);
}

function extractAfterPatterns(raw, patterns) {
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      const value = cleanValue(match[1]);
      if (value) return value;
    }
  }
  return "";
}

function extractSimpleName(raw, t, entity) {
  const quoted = raw.match(/["“]([^"”]+)["”]/);
  if (quoted?.[1]) return titleValue(quoted[1]);

  const patterns = {
    bovino: [
      /(?:llamad[oa]|nombre|se llama)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ0-9_-]+)/i,
      /(?:a|al|para|del|de la|de)\s+(?:bovino|vaca|toro)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ0-9_-]+)/i,
      /(?:bovino|vaca|toro)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ0-9_-]+)/i
    ],
    vacuna: [
      /vacuna\s+(?:llamad[oa]|de nombre)?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ0-9 _-]+)/i,
      /(?:crear|crea|agregar|agrega|eliminar|elimina)\s+(?:la\s+)?vacuna\s+([A-Za-zÁÉÍÓÚáéíóúÑñ0-9 _-]+)/i
    ],
    dueno: [
      /(?:due[nñ]o)\s+(?:llamad[oa]|de nombre)?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ0-9 _-]+)/i
    ],
    rancho: [
      /rancho\s+(?:llamad[oa]|de nombre)?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ0-9 _-]+)/i
    ]
  };

  const value = extractAfterPatterns(raw, patterns[entity] ?? []);
  const first = normalizeText(value).split(/\s+/)[0] ?? "";
  if (!value || STOP_ENTITY_WORDS.has(first)) return "";
  return titleValue(value);
}

function extractBovinoFields(raw) {
  const t = normalizeText(raw);
  const args = extractBovinoEntities(raw);

  const contradiction =
    /\bvaca\b/.test(t) && /\b(macho|masculino)\b/.test(t) ||
    /\btoro\b/.test(t) && /\b(hembra|femenino)\b/.test(t);

  return { args, contradiction };
}

function extractAction(raw) {
  const t = normalizeText(raw);

  if (hasAny(t, ["registrar", "registra", "crear", "crea", "agregar", "agrega", "dar de alta"]) &&
      hasAny(t, ["bovino", "vaca", "toro"])) {
    const parsed = extractBovinoFields(raw);
    return { tool: "crearBovino", args: parsed.args, contradiction: parsed.contradiction };
  }

  if (hasAny(t, ["crear", "crea", "agregar", "agrega", "registrar", "registra"]) && t.includes("vacuna")) {
    return { tool: "crearVacuna", args: { nombre: extractSimpleName(raw, t, "vacuna") } };
  }

  if (hasAny(t, ["crear", "crea", "agregar", "agrega", "registrar", "registra"]) && /due[nñ]o/.test(t)) {
    return { tool: "crearDueno", args: { nombre: extractSimpleName(raw, t, "dueno") } };
  }

  if (hasAny(t, ["crear", "crea", "agregar", "agrega", "registrar", "registra"]) && t.includes("rancho")) {
    return { tool: "crearRancho", args: { nombre: extractSimpleName(raw, t, "rancho") } };
  }

  if (hasAny(t, ["aplicar", "aplica", "aplicale", "poner", "ponle"]) && t.includes("vacuna")) {
    const vacuna =
      titleValue(extractAfterPatterns(raw, [
        /vacuna\s+(?:llamad[oa]|de nombre)?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ0-9 _-]+?)\s+(?:a|al|para)\s+/i
      ])) ||
      extractSimpleName(raw, t, "vacuna");
    const bovino = extractSimpleName(raw, t, "bovino") ||
      titleValue(extractAfterPatterns(raw, [/\b(?:a|al|para)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ0-9_-]+)[.!?]?$/i]));
    return { tool: "aplicarVacuna", args: { nombre_vaca: bovino, vacuna_nombre: vacuna } };
  }

  if (hasAny(t, ["peso", "pesa", "kg", "kilos"]) && hasAny(t, ["registrar", "registra", "anotar", "anota", "poner", "ponle", "cambiar", "cambia", "actualizar", "actualiza"])) {
    const peso = Number((raw.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos)?/i)?.[1] ?? "").replace(",", "."));
    const bovino = extractSimpleName(raw, t, "bovino") ||
      titleValue(extractAfterPatterns(raw, [/(?:para|a|de)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ0-9_-]+)$/i]));
    return { tool: "registrarPeso", args: { nombre: bovino, peso: Number.isFinite(peso) ? peso : undefined } };
  }

  if (t.includes("enfermedad") && hasAny(t, ["registrar", "registra", "aplicar", "aplica", "anotar", "anota"])) {
    const enfermedad = extractAfterPatterns(raw, [/enfermedad\s+(?:llamada|de nombre)?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ0-9 _-]+)/i]);
    const bovino = extractSimpleName(raw, t, "bovino");
    return { tool: "registrarEnfermedad", args: { nombre_vaca: bovino, enfermedad: titleValue(enfermedad) } };
  }

  if (hasAny(t, ["transferir", "transfiere", "asignar", "asigna"]) &&
      hasAny(t, ["propiedad", "dueno", "dueño", "rancho", "bovino", "vaca", "toro"])) {
    const bovino = extractSimpleName(raw, t, "bovino");
    const dueno = extractSimpleName(raw, t, "dueno");
    const rancho = extractSimpleName(raw, t, "rancho");
    return { tool: "transferirPropiedad", args: { nombre_vaca: bovino, dueno_nombre: dueno, rancho_nombre: rancho } };
  }

  if (hasAny(t, ["eliminar", "elimina", "borrar", "borra", "quitar", "quita"])) {
    if (hasAny(t, ["bovino", "vaca", "toro"])) {
      return { tool: "eliminarBovino", args: { nombre: extractSimpleName(raw, t, "bovino") } };
    }
    if (t.includes("vacuna")) return { tool: "eliminarVacuna", args: { nombre: extractSimpleName(raw, t, "vacuna") } };
    if (/due[nñ]o/.test(t)) return { tool: "eliminarDueno", args: { nombre: extractSimpleName(raw, t, "dueno") } };
    if (t.includes("rancho")) return { tool: "eliminarRancho", args: { nombre: extractSimpleName(raw, t, "rancho") } };
  }

  return null;
}

function extractArgsForPending(tool, raw) {
  const t = normalizeText(raw);

  if (tool === "crearBovino") {
    return extractBovinoFields(raw).args;
  }

  if (tool === "crearVacuna") {
    return { nombre: extractSimpleName(raw, t, "vacuna") || titleValue(raw) };
  }

  if (tool === "crearDueno") {
    return { nombre: extractSimpleName(raw, t, "dueno") || titleValue(raw) };
  }

  if (tool === "crearRancho") {
    return { nombre: extractSimpleName(raw, t, "rancho") || titleValue(raw) };
  }

  if (tool === "aplicarVacuna") {
    const action = extractAction(`aplica vacuna ${raw}`);
    return action?.args ?? {};
  }

  if (tool === "registrarPeso") {
    const peso = Number((raw.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos)?/i)?.[1] ?? "").replace(",", "."));
    const nombre = extractSimpleName(raw, t, "bovino");
    return {
      ...(nombre ? { nombre } : {}),
      ...(Number.isFinite(peso) ? { peso } : {})
    };
  }

  if (tool === "registrarEnfermedad") {
    const action = extractAction(`registra enfermedad ${raw}`);
    return action?.args ?? {};
  }

  if (tool === "transferirPropiedad") {
    const action = extractAction(`transfiere propiedad ${raw}`);
    return action?.args ?? {};
  }

  return {};
}

function detectQuery(raw) {
  const t = normalizeText(raw);

  if (hasAny(t, ["lista para venta", "lista para la venta", "apta para venta", "se puede vender", "puedo vender"]) && !hasAny(t, ["cuales", "lista de", "listos para venta", "aptos para venta"])) {
    return {
      type: "readiness",
      target: "venta_estado",
      args: { nombre: extractSimpleName(raw, t, "bovino") }
    };
  }

  if (/\b(cuantos|cuantas|total|numero de|conteo)\b/.test(t)) {
    if (hasAny(t, ["toros", "macho", "machos"])) return { type: "count", target: "toros" };
    if (hasAny(t, ["vacas", "hembra", "hembras"])) return { type: "count", target: "vacas" };
    if (t.includes("rancho")) return { type: "count", target: "ranchos" };
    if (/due[nñ]o/.test(t)) return { type: "count", target: "duenos" };
    if (t.includes("vacuna")) return { type: "count", target: "vacunas_catalogo" };
    return { type: "count", target: "bovinos" };
  }

  if (
    t.includes("vacunas") &&
    hasAny(t, ["catalogo", "catalogo", "mis vacunas", "tengo", "se llaman", "llaman"])
  ) {
    return { type: "list", target: "vacunas_catalogo" };
  }

  if (hasAny(t, ["muestrame", "mostrar", "lista", "listar", "cuales", "que"]) &&
      hasAny(t, ["bovinos", "vacas", "toros"])) {
    return { type: "list", target: "bovinos" };
  }

  if (hasAny(t, ["muestrame", "mostrar", "lista", "listar", "cuales", "que"]) && t.includes("rancho")) {
    return { type: "list", target: "ranchos" };
  }

  if (hasAny(t, ["muestrame", "mostrar", "lista", "listar", "cuales", "que"]) && /due[nñ]o/.test(t)) {
    return { type: "list", target: "duenos" };
  }

  if (hasAny(t, ["lista para venta", "listos para venta", "aptos para venta", "aptas para venta"])) {
    return { type: "list", target: "venta_listos" };
  }

  if (hasAny(t, ["busca", "buscar"]) && hasAny(t, ["arete"])) {
    const arete = extractAfterPatterns(raw, [/arete\s*(?:es|:|-)?\s*([A-Za-z0-9_.-]+)/i, /\b([A-Za-z]{1,5}[-_.]?\d{2,8})\b/i]);
    return { type: "search", target: "bovino_arete", args: { numero_arete: arete } };
  }

  return null;
}

function missingFor(tool, args) {
  if (tool === "transferirPropiedad") {
    const missing = [];
    if (!args.nombre_vaca) missing.push("nombre_vaca");
    if (!args.dueno_nombre && !args.rancho_nombre) missing.push("dueno_o_rancho");
    return missing;
  }

  return (REQUIRED[tool] ?? []).filter((key) => {
    const value = args[key];
    return value === undefined || value === null || value === "" || Number.isNaN(value);
  });
}

function fieldLabel(field) {
  return {
    nombre: "nombre",
    sexo: "sexo",
    raza: "raza",
    nombre_vaca: "nombre del bovino",
    vacuna_nombre: "nombre de la vacuna",
    peso: "peso",
    enfermedad: "nombre de la enfermedad",
    dueno_o_rancho: "dueno o rancho"
  }[field] ?? field;
}

function knownText(args) {
  const entries = Object.entries(args)
    .filter(([, value]) => value !== undefined && value !== null && value !== "" && !Number.isNaN(value))
    .map(([key, value]) => `${fieldLabel(key)}: ${value}`);

  return entries.length ? ` Ya tengo ${entries.join(", ")}.` : "";
}

function missingResponse(tool, args, missing) {
  const label = TOOL_LABELS[tool] ?? "completar la accion";
  const fields = missing.map(fieldLabel);
  return `De acuerdo. Para ${label} me falta ${fields.join(", ")}.${knownText(args)}`;
}

function confirmationResponse(tool, args) {
  const label = TOOL_LABELS[tool] ?? "ejecutar la accion";
  const detail = Object.entries(args)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${fieldLabel(key)}: ${value}`)
    .join(", ");
  const warning = ["eliminarBovino", "eliminarVacuna", "eliminarDueno", "eliminarRancho", "transferirPropiedad"].includes(tool)
    ? " Esta accion puede afectar registros relacionados."
    : "";
  const autoArete = tool === "crearBovino"
    ? " El arete se generara automaticamente."
    : "";
  return `Confirmas que deseas ${label}${detail ? ` (${detail})` : ""}?${autoArete}${warning}`;
}

function applyConversationContext(action, raw, context) {
  if (!action || !context?.ultimo_bovino_nombre) return action;
  const t = normalizeText(raw);
  const referencesRecent = /\b(la vaca|el bovino|esa vaca|ese bovino|ella|el|su peso|ponle|cambiale)\b/.test(t);
  if (!referencesRecent) return action;
  if (action.tool === "registrarPeso" && !action.args.nombre) action.args.nombre = context.ultimo_bovino_nombre;
  if (["aplicarVacuna", "registrarEnfermedad", "transferirPropiedad"].includes(action.tool) && !action.args.nombre_vaca) {
    action.args.nombre_vaca = context.ultimo_bovino_nombre;
  }
  return action;
}

export function planIaTurn({ text, pending, context = null }) {
  const raw = String(text ?? "").trim();
  if (!raw) return { kind: "empty", respuesta: "Escribe una pregunta o accion." };

  if (pending && isCancel(raw)) {
    return { kind: "clear", respuesta: "Listo, cancele la accion pendiente." };
  }

  if (pending?.awaitingConfirmation) {
    if (isConfirmation(raw)) {
      return { kind: "execute", tool: pending.tool, args: pending.args, clearPending: true };
    }
    if (isRejection(raw)) {
      return { kind: "clear", respuesta: "De acuerdo, no ejecuto la accion." };
    }
  }

  const action = applyConversationContext(extractAction(raw), raw, context);
  if (pending && !action) {
    const extractedArgs = extractArgsForPending(pending.tool, raw);
    const merged = { ...pending.args, ...extractedArgs };
    const missing = missingFor(pending.tool, merged);
    if (missing.length) {
      return {
        kind: "pending",
        pending: { ...pending, args: merged, missing, awaitingConfirmation: false },
        respuesta: missingResponse(pending.tool, merged, missing)
      };
    }
    return {
      kind: "pending",
      pending: { ...pending, args: merged, missing: [], awaitingConfirmation: true },
      respuesta: confirmationResponse(pending.tool, merged)
    };
  }

  if (action) {
    if (action.contradiction) {
      return {
        kind: "clarify",
        respuesta: "Detecte una contradiccion: una vaca debe ser hembra y un toro debe ser macho. Indica si deseas registrarla como vaca hembra o toro macho."
      };
    }

    const missing = missingFor(action.tool, action.args);
    if (missing.length) {
      return {
        kind: "pending",
        pending: { tool: action.tool, args: action.args, missing, awaitingConfirmation: false },
        respuesta: missingResponse(action.tool, action.args, missing)
      };
    }

    if (WRITE_TOOLS.has(action.tool)) {
      return {
        kind: "pending",
        pending: { tool: action.tool, args: action.args, missing: [], awaitingConfirmation: true },
        respuesta: confirmationResponse(action.tool, action.args)
      };
    }

    return { kind: "execute", tool: action.tool, args: action.args, clearPending: false };
  }

  const query = detectQuery(raw);
  if (query) return { kind: "query", query };

  return { kind: "none" };
}

export const __test = {
  normalizeText,
  extractAction,
  detectQuery,
  missingFor
};
