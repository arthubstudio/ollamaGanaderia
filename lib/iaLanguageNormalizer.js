const COMMON_MISSPELLINGS = new Map([
  ["q", "que"],
  ["k", "que"],
  ["ke", "que"],
  ["qe", "que"],
  ["xq", "porque"],
  ["xque", "porque"],
  ["kiero", "quiero"],
  ["kiro", "quiero"],
  ["quero", "quiero"],
  ["ase", "hace"],
  ["hase", "hace"],
  ["aser", "hacer"],
  ["acer", "hacer"],
  ["accer", "hacer"],
  ["sirbe", "sirve"],
  ["sirven", "sirven"],
  ["sitema", "sistema"],
  ["sistma", "sistema"],
  ["funcioens", "funciones"],
  ["funcciones", "funciones"],
  ["rejistra", "registra"],
  ["rejistrar", "registrar"],
  ["registraar", "registrar"],
  ["actualisar", "actualizar"],
  ["trasferir", "transferir"],
  ["trasfiere", "transfiere"],
  ["tranferir", "transferir"],
  ["tranfiere", "transfiere"],
  ["baca", "vaca"],
  ["bacas", "vacas"],
  ["vakka", "vaca"],
  ["bobino", "bovino"],
  ["bobinos", "bovinos"],
  ["bovyno", "bovino"],
  ["bacuna", "vacuna"],
  ["bacunas", "vacunas"],
  ["vacunna", "vacuna"],
  ["vacunnas", "vacunas"],
  ["rrancho", "rancho"],
  ["ranchoo", "rancho"],
  ["duenio", "dueno"],
  ["duenia", "dueno"],
  ["pezo", "peso"],
  ["peza", "pesa"],
  ["kilage", "kilaje"],
  ["emfermedad", "enfermedad"],
  ["emfermedades", "enfermedades"],
  ["enfermeda", "enfermedad"],
  ["trasferencia", "transferencia"],
  ["trasferencias", "transferencias"],
  ["amistat", "amistad"],
  ["mensage", "mensaje"],
  ["mensages", "mensajes"]
]);

const SEMANTIC_EQUIVALENTS = new Map([
  ["res", "bovino"],
  ["reses", "bovinos"],
  ["finca", "rancho"],
  ["hacienda", "rancho"],
  ["establo", "rancho"],
  ["propietario", "dueno"],
  ["propietaria", "dueno"],
  ["propietarios", "duenos"],
  ["propietarias", "duenos"],
  ["inmunizacion", "vacunacion"],
  ["inmunizaciones", "vacunas"],
  ["kilaje", "peso"],
  ["padecimiento", "enfermedad"],
  ["padecimientos", "enfermedades"],
  ["comercializacion", "venta"],
  ["comercializar", "vender"],
  ["traspaso", "transferencia"],
  ["traspasos", "transferencias"],
  ["chat", "mensajes"],
  ["chats", "mensajes"]
]);

const SENSITIVE_PATTERN =
  /(["“][^"”]+["”]|'[^']+'|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/\S+|\b[A-Z]{1,8}[-_.]\d{1,12}\b|\b(?=[A-Z0-9_-]*[A-Z])(?=[A-Z0-9_-]*\d)[A-Z0-9_-]{3,}\b|\b\d+(?:[.,]\d+)?\b)/giu;

function protectSensitiveValues(value) {
  const protectedValues = [];
  const text = value.replace(SENSITIVE_PATTERN, (match) => {
    const placeholder = `zzprotectedvalue${protectedValues.length}zz`;
    protectedValues.push(match);
    return placeholder;
  });

  return { text, protectedValues };
}

function restoreSensitiveValues(value, protectedValues) {
  return protectedValues.reduce(
    (text, protectedValue, index) =>
      text.replace(`zzprotectedvalue${index}zz`, protectedValue),
    value
  );
}

function normalizeBase(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!()[\]{}:;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Creates a canonical shadow used only for intent classification.
 * The original message remains untouched and must be used for tool arguments.
 */
export function analyzeIaText(value) {
  const original = String(value ?? "");
  const { text: protectedText, protectedValues } =
    protectSensitiveValues(original);
  const corrections = [];

  const corrected = normalizeBase(protectedText)
    .split(" ")
    .filter(Boolean)
    .map((token) => {
      const spellingCorrection = COMMON_MISSPELLINGS.get(token);
      const semanticEquivalent =
        SEMANTIC_EQUIVALENTS.get(spellingCorrection ?? token);
      const replacement =
        semanticEquivalent ?? spellingCorrection ?? token;

      if (replacement !== token) {
        corrections.push({ from: token, to: replacement });
      }

      return replacement;
    })
    .join(" ")
    .replace(/\bpa que\b/g, "para que")
    .replace(/\bpa el\b/g, "para el")
    .replace(/\bpa la\b/g, "para la")
    .replace(/\s+/g, " ")
    .trim();

  return {
    original,
    normalized: restoreSensitiveValues(corrected, protectedValues),
    corrections,
    protectedValues
  };
}

export function normalizeIaText(value) {
  return analyzeIaText(value).normalized;
}

export const __test = {
  COMMON_MISSPELLINGS,
  SEMANTIC_EQUIVALENTS,
  protectSensitiveValues
};
