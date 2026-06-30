import { normalizeRouterText } from "~/lib/bovinoRouterHelpers";

const STOPWORDS = new Set([
  "la", "el", "los", "las", "de", "del", "y", "o", "a", "al", "en",
  "que", "se", "su", "sus", "un", "una", "con", "por", "para", "le",
  "lo", "es", "son", "si", "no", "ya", "sobre", "bovino", "vaca", "toro"
]);

export type InferredRegistrarEnfermedad = {
  tool: "registrarEnfermedad";
  args: {
    nombre: string;
    enfermedad: string;
    tratamiento?: string;
    fecha?: string;
    veterinario?: string;
  };
};

export type InferredAplicarVacuna = {
  tool: "aplicarVacuna";
  args: {
    nombre_vaca: string;
    vacuna_nombre: string;
    fecha_aplicacion?: string;
    veterinario?: string;
    observaciones?: string;
  };
};

export type InferredTransferirPropiedad = {
  tool: "transferirPropiedad";
  args: {
    nombre_vaca: string;
    dueno_nombre?: string;
    rancho_nombre?: string;
    fecha_inicio?: string;
    observaciones?: string;
  };
};

export type InferredWriteAction =
  | InferredRegistrarEnfermedad
  | InferredAplicarVacuna
  | InferredTransferirPropiedad;

function hasWriteVerb(text: string) {
  return /\b(aplica|aplicar|aplicale|aplicarle|registra|registrar|agrega|agregar|anade|anadir|asigna|asignar|asignale|asignarle|transfiere|transferir|transferirle|transfierelo|transfierela|ponle|anota|anotar)\b/.test(
    text
  );
}

function extractBovinoFromQuestion(
  pregunta: string,
  nombreAnimalContexto?: string | null
) {
  const contextMatch = pregunta.match(
    /\(sobre el bovino\s+([^)]+)\)/i
  );
  if (contextMatch?.[1]?.trim()) {
    return contextMatch[1].trim();
  }

  if (nombreAnimalContexto?.trim()) {
    return nombreAnimalContexto.trim();
  }

  const patterns = [
    /\b(?:a|al|para)\s+(?:la\s+)?(?:vaca|bovino|toro)\s+([a-z0-9_-]+)/i,
    /\b(?:vaca|bovino|toro)\s+([a-z0-9_-]+)/i
  ];

  for (const pattern of patterns) {
    const match = pregunta.match(pattern);
    const token = match?.[1]?.trim();
    if (token && !STOPWORDS.has(normalizeRouterText(token))) {
      return token;
    }
  }

  return "";
}

function extractTokenAfter(
  text: string,
  pattern: RegExp
): string | null {
  const match = text.match(pattern);
  const token = match?.[1]?.trim();
  if (!token) return null;
  if (STOPWORDS.has(normalizeRouterText(token))) return null;
  return token;
}

export function inferRegistrarEnfermedad(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredRegistrarEnfermedad | null {
  const t = normalizeRouterText(pregunta);

  if (!/\benfermedad/.test(t)) return null;
  if (/\bvacuna/.test(t)) return null;
  if (!hasWriteVerb(t) && !/\benfermedad\s+[a-z0-9_-]/.test(t)) {
    return null;
  }

  const enfermedad =
    extractTokenAfter(t, /\benfermedad\s+(?:llamada\s+|de\s+nombre\s+)?([a-z0-9_-]+)/i) ??
    extractTokenAfter(
      t,
      /(?:aplicar(?:le)?|registrar|asignar(?:le)?|anotar|poner)\s+(?:la\s+)?enfermedad\s+([a-z0-9_-]+)/i
    );

  if (!enfermedad) return null;

  const nombre = extractBovinoFromQuestion(pregunta, nombreAnimalContexto);
  if (!nombre) return null;

  const tratamiento = extractTokenAfter(
    t,
    /tratamiento\s+(?:de\s+|:\s*)?([a-z0-9_-]+(?:\s+[a-z0-9_-]+){0,4})/i
  );

  return {
    tool: "registrarEnfermedad",
    args: {
      nombre,
      enfermedad,
      tratamiento: tratamiento ?? undefined
    }
  };
}

export function inferAplicarVacuna(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredAplicarVacuna | null {
  const t = normalizeRouterText(pregunta);

  if (/\benfermedad/.test(t)) return null;
  if (!/\bvacuna/.test(t)) return null;
  if (!hasWriteVerb(t) && !/\bvacuna\s+[a-z0-9_-]/.test(t)) {
    return null;
  }

  const vacuna_nombre =
    extractTokenAfter(t, /\bvacuna\s+(?:llamada\s+|de\s+nombre\s+)?([a-z0-9_-]+)/i) ??
    extractTokenAfter(
      t,
      /(?:aplicar(?:le)?|registrar|asignar(?:le)?|agregar|anotar|poner)\s+(?:la\s+)?vacuna\s+([a-z0-9_-]+)/i
    );

  if (!vacuna_nombre) return null;

  const nombre_vaca = extractBovinoFromQuestion(pregunta, nombreAnimalContexto);
  if (!nombre_vaca) return null;

  return {
    tool: "aplicarVacuna",
    args: {
      nombre_vaca,
      vacuna_nombre
    }
  };
}

export function inferTransferirPropiedad(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredTransferirPropiedad | null {
  const t = normalizeRouterText(pregunta);

  const mencionaDueno = /\b(dueno|dueño)\b/.test(t);
  const mencionaRancho = /\brancho/.test(t);
  const mencionaTransferencia =
    /\b(transferir|transferencia|transfiere|transfierelo|transfierela|propiedad)\b/.test(
      t
    );

  if (!mencionaDueno && !mencionaRancho && !mencionaTransferencia) {
    return null;
  }

  if (!hasWriteVerb(t) && !mencionaTransferencia) {
    return null;
  }

  const dueno_nombre =
    extractTokenAfter(t, /(?:dueno|dueño)\s+(?:llamado\s+|de\s+nombre\s+)?([a-z0-9_-]+)/i) ??
    extractTokenAfter(
      t,
      /(?:transferir(?:le)?|asignar(?:le)?)\s+(?:al\s+)?(?:dueno|dueño)\s+([a-z0-9_-]+)/i
    );

  const rancho_nombre =
    extractTokenAfter(t, /\brancho\s+(?:llamado\s+|de\s+nombre\s+)?([a-z0-9_-]+)/i) ??
    extractTokenAfter(
      t,
      /(?:transferir(?:le)?|asignar(?:le)?)\s+(?:al\s+)?rancho\s+([a-z0-9_-]+)/i
    );

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

export function inferWriteActionFromQuestion(
  pregunta: string,
  nombreAnimalContexto?: string | null
): InferredWriteAction | null {
  return (
    inferRegistrarEnfermedad(pregunta, nombreAnimalContexto) ??
    inferAplicarVacuna(pregunta, nombreAnimalContexto) ??
    inferTransferirPropiedad(pregunta, nombreAnimalContexto)
  );
}
