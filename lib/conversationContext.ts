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

export function matchAnimalInText(text: string, bovinos: BovinoRef[]) {
  const normalized = normalizeContextText(text);

  return (
    bovinos.find((v) => {
      const nombre = normalizeContextText(v.nombre ?? "");
      const arete = normalizeContextText(v.numero_arete ?? "");

      return (
        (nombre.length >= 2 && normalized.includes(nombre)) ||
        (arete.length >= 2 && normalized.includes(arete))
      );
    }) ?? null
  );
}

const FOLLOW_UP_PATTERNS = [
  /^y\b/,
  /\btambien\b/,
  /\besa\b/,
  /\bese\b/,
  /\beso\b/,
  /\bella\b/,
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
  bovinos: BovinoRef[],
  historial: HistorialMessage[]
) {
  const inCurrent = matchAnimalInText(pregunta, bovinos);
  if (inCurrent) return inCurrent;

  if (!historial.length || !isContextualFollowUp(pregunta)) {
    return null;
  }

  for (let i = historial.length - 1; i >= 0; i--) {
    const match = matchAnimalInText(historial[i]?.content ?? "", bovinos);
    if (match) return match;
  }

  return null;
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

  return `${preguntaOriginal} (sobre ${animal.nombre})`;
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
