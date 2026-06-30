import { normalizarSexo } from "~/lib/bovinoValidation";
import { normalizeRouterText } from "~/lib/bovinoRouterHelpers";

const SEXO_TOKENS = new Set([
  "macho",
  "machos",
  "hembra",
  "hembras",
  "m",
  "f",
  "masculino",
  "femenino",
  "vaca",
  "vacas",
  "toro",
  "toros",
  "male",
  "female"
]);

const RAZAS_CONOCIDAS = [
  "holstein",
  "angus",
  "brahman",
  "brangus",
  "hereford",
  "jersey",
  "simmental",
  "charolais",
  "limousin",
  "brahming",
  "bramming",
  "girolando",
  "gyr",
  "nelore",
  "cebú",
  "cebu",
  "pardo suizo",
  "montbeliard"
];

function looksLikeArete(token: string) {
  const t = token.trim();
  if (!t) return false;
  if (/^[A-Za-z]{1,4}[-_.]?\d{1,6}$/.test(t)) return true;
  if (/^[A-Za-z0-9]{2,4}[-_.][A-Za-z0-9]{1,6}$/.test(t)) return true;
  if (/^\d{2,}[A-Za-z]?$/.test(t)) return true;
  if (/^[A-Za-z]\d{2,}$/.test(t)) return true;
  if (/^[A-Za-z]{2,}\d{2,}$/i.test(t)) return true;
  return false;
}

function looksLikeNombre(token: string) {
  const t = token.trim();
  if (!t || t.length < 2) return false;
  if (looksLikeArete(t)) return false;
  if (SEXO_TOKENS.has(normalizeRouterText(t))) return false;
  if (RAZAS_CONOCIDAS.includes(normalizeRouterText(t))) return false;
  if (/^\d+$/.test(t)) return false;
  return /^[A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ0-9_-]{0,30}$/.test(t);
}

function looksLikeRaza(token: string) {
  const norm = normalizeRouterText(token);
  if (RAZAS_CONOCIDAS.some((r) => norm.includes(r) || r.includes(norm))) {
    return true;
  }
  return /^[A-Za-zÁÉÍÓÚáéíóúÑñ]{3,20}$/.test(token.trim());
}

function parseSexoToken(token: string) {
  const result = normalizarSexo(token);
  return result.ok ? result.sexo : null;
}

export type ParsedBovinoFields = {
  numero_arete?: string;
  nombre?: string;
  raza?: string;
  sexo?: string;
};

export function parseBovinoFieldsFromText(text: string): ParsedBovinoFields | null {
  const raw = (text ?? "").trim();
  if (!raw) return null;

  const labeled: ParsedBovinoFields = {};

  const areteMatch = raw.match(
    /(?:arete|n[°º]?)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\s\-_.]{0,49})/i
  );
  if (areteMatch?.[1]) labeled.numero_arete = areteMatch[1].trim();

  const nombreMatch = raw.match(
    /(?:nombre)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ0-9_\s-]{0,40})/i
  );
  if (nombreMatch?.[1]) labeled.nombre = nombreMatch[1].trim();

  const razaMatch = raw.match(
    /(?:raza)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ0-9_\s-]{0,40})/i
  );
  if (razaMatch?.[1]) labeled.raza = razaMatch[1].trim();

  const sexoMatch = raw.match(/(?:sexo)\s*[:\-]?\s*(\S+(?:\s+\S+)?)/i);
  if (sexoMatch?.[1]) {
    const sexo = parseSexoToken(sexoMatch[1]);
    if (sexo) labeled.sexo = sexo;
  }

  if (labeled.numero_arete && labeled.nombre && labeled.raza && labeled.sexo) {
    return labeled;
  }

  const tokens = raw
    .split(/[,;|]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (tokens.length < 2) return Object.keys(labeled).length ? labeled : null;

  const parsed: ParsedBovinoFields = { ...labeled };
  const unassigned: string[] = [];

  for (const token of tokens) {
    const norm = normalizeRouterText(token);
    const sexo = parseSexoToken(token);
    if (sexo) {
      parsed.sexo = sexo;
      continue;
    }
    if (SEXO_TOKENS.has(norm)) continue;

    if (!parsed.numero_arete && looksLikeArete(token)) {
      parsed.numero_arete = token.trim();
      continue;
    }

    if (!parsed.raza && looksLikeRaza(token) && !looksLikeNombre(token)) {
      parsed.raza = token.trim();
      continue;
    }

    if (!parsed.nombre && looksLikeNombre(token)) {
      parsed.nombre = token.trim();
      continue;
    }

    unassigned.push(token);
  }

  for (const token of unassigned) {
    if (!parsed.raza && looksLikeRaza(token)) {
      parsed.raza = token.trim();
    } else if (!parsed.nombre && looksLikeNombre(token)) {
      parsed.nombre = token.trim();
    } else if (!parsed.numero_arete && looksLikeArete(token)) {
      parsed.numero_arete = token.trim();
    }
  }

  if (parsed.nombre && parsed.numero_arete && parsed.raza && parsed.sexo) {
    return parsed;
  }

  return Object.keys(parsed).length >= 2 ? parsed : null;
}
