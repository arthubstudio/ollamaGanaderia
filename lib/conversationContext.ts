type BovinoRef = {
  id?: number;
  nombre?: string | null;
  numero_arete?: string | null;
};

type HistorialMessage = {
  role: string;
  content: string;
};

export function normalizeContextText(value: string) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findBovinoByExactNombre(nombre: string, bovinos: BovinoRef[]) {
  const norm = normalizeContextText(nombre);
  if (!norm) return null;

  return (
    bovinos.find((v) => normalizeContextText(v.nombre ?? "") === norm) ?? null
  );
}

export function matchAnimalInText(text: string, bovinos: BovinoRef[]) {
  const normalized = normalizeContextText(text);
  let best: { bovino: BovinoRef; score: number } | null = null;

  for (const v of bovinos) {
    const nombre = normalizeContextText(v.nombre ?? "");
    const arete = normalizeContextText(v.numero_arete ?? "");

    if (nombre.length >= 2 && normalized.includes(nombre)) {
      const score = 100 + nombre.length;
      if (!best || score > best.score) best = { bovino: v, score };
    }

    if (arete.length >= 2 && normalized.includes(arete)) {
      const score = 50 + arete.length;
      if (!best || score > best.score) best = { bovino: v, score };
    }
  }

  return best?.bovino ?? null;
}

export function extractNombreFromRegistration(text: string): string | null {
  const match = text.match(/nombre\s*:\s*([^\n|*•\-]+)/i);
  return match?.[1]?.trim() || null;
}

export function findLastAnimalInHistorial(
  historial: HistorialMessage[],
  bovinos: BovinoRef[]
) {
  for (let i = historial.length - 1; i >= 0; i--) {
    const content = historial[i]?.content ?? "";

    const extractedNombre = extractNombreFromRegistration(content);
    if (extractedNombre) {
      const byNombre = findBovinoByExactNombre(extractedNombre, bovinos);
      if (byNombre) return byNombre;
    }

    const match = matchAnimalInText(content, bovinos);
    if (match) return match;
  }

  return null;
}

const FOLLOW_UP_PATTERNS = [
  /^y\b/,
  /^\s*si[\.,!\s]/,
  /\btambien\b/,
  /\besa\b/,
  /\bese\b/,
  /\beso\b/,
  /\bella\b/,
  /\bel\b/,
  /\baplicale\b/,
  /\baplicarle\b/,
  /\basignale\b/,
  /\basignarle\b/,
  /\bponle\b/,
  /\banterior\b/,
  /\bprevio\b/,
  /\bprevia\b/,
  /\bde esa\b/,
  /\bde ese\b/,
  /\blo de antes\b/,
  /\bla de antes\b/,
  /\binformacion anterior\b/,
  /\bque mas\b/,
  /\bdime mas\b/,
  /\bcuanto pesa\b/,
  /\bsus vacunas\b/,
  /\bsus enfermedades\b/,
  /\bsu peso\b/,
  /\bsu edad\b/,
  /\bsu historial\b/
];

export function isVaccineActionWithoutAnimalForBovinos(
  pregunta: string,
  bovinosList: BovinoRef[]
) {
  const t = normalizeContextText(pregunta);

  const esAccionConBovino =
    /\b(aplica|aplicar|aplicale|registra|registrar|agrega|agregar|anade|anadir|crea|crear|asigna|asignar|asignale|transfiere|transferir)\b/.test(
      t
    ) &&
    (/\bvacuna/.test(t) ||
      /\benfermedad/.test(t) ||
      /\b(dueno|dueño|rancho|propiedad|transferencia)\b/.test(t));

  if (!esAccionConBovino) return false;

  const tieneAnimalExplicito = bovinosList.some((v) => {
    const nombre = normalizeContextText(v.nombre ?? "");
    return nombre.length >= 2 && t.includes(nombre);
  });

  return !tieneAnimalExplicito;
}

export function isContextualFollowUp(pregunta: string) {
  const t = normalizeContextText(pregunta);

  if (FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(t))) {
    return true;
  }

  const words = t.split(" ").filter(Boolean);
  const esPreguntaCorta = words.length <= 6 && (t.includes("?") || t.startsWith("y "));

  return esPreguntaCorta;
}

export function resolveAnimalFromContext(
  pregunta: string,
  bovinosList: BovinoRef[],
  historial: HistorialMessage[]
) {
  const inCurrent = matchAnimalInText(pregunta, bovinosList);
  if (inCurrent) return inCurrent;

  if (!historial.length) return null;

  const needsHistorialContext =
    isContextualFollowUp(pregunta) ||
    isVaccineActionWithoutAnimalForBovinos(pregunta, bovinosList);

  if (!needsHistorialContext) return null;

  return findLastAnimalInHistorial(historial, bovinosList);
}

export function enrichQuestionWithAnimal(
  preguntaOriginal: string,
  animal: BovinoRef | null
) {
  if (!animal?.nombre) return preguntaOriginal;

  const normalized = normalizeContextText(preguntaOriginal);
  const nombreNorm = normalizeContextText(animal.nombre);

  if (normalized.includes(nombreNorm)) {
    return preguntaOriginal;
  }

  return `${preguntaOriginal} (sobre el bovino ${animal.nombre})`;
}

export function buildHistorialMessages(
  historial: HistorialMessage[],
  limit = 10
) {
  return historial.slice(-limit).map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: m.content ?? ""
  }));
}
