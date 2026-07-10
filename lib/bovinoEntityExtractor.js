const BANNED_VALUES = new Set([
  "es", "sera", "será", "tengo", "tiene", "tendra", "tendrá",
  "crear", "crea", "registrar", "registra", "vaca", "toro", "bovino",
  "arete", "nombre", "raza", "sexo"
]);

const KNOWN_BREEDS = [
  "holstein", "angus", "brahman", "brangus", "hereford", "jersey",
  "simmental", "charolais", "limousin", "girolando", "gyr", "nelore",
  "cebu", "cebú", "pardo suizo"
];

function normalize(value) {
  return String(value ?? "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim();
}

function clean(value) {
  return String(value ?? "").replace(/^[\s:,-]+|[\s.,;:!?]+$/g, "").trim();
}

function validValue(value) {
  const result = clean(value);
  return result && !BANNED_VALUES.has(normalize(result)) ? result : "";
}

function title(value) {
  return clean(value).split(/\s+/).map((part) =>
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join(" ");
}

function firstMatch(raw, patterns) {
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const value = validValue(match?.[1]);
    if (value) return value;
  }
  return "";
}

export function extractBovinoEntities(text) {
  const raw = String(text ?? "").trim();
  const normalized = normalize(raw);
  const result = {};

  const nombre = firstMatch(raw, [
    /(?:el|su)?\s*nombre\s+(?:es|sera|será|va\s+a\s+ser)\s+([\p{L}][\p{L}0-9_-]{1,30})/iu,
    /(?:se\s+llama|se\s+llamara|se\s+llamará)\s+([\p{L}][\p{L}0-9_-]{1,30})/iu,
    /(?:llamado|llamada)\s+([\p{L}][\p{L}0-9_-]{1,30})/iu,
    /(?:ponle|llamalo|llámalo|llamala|llámala)\s+([\p{L}][\p{L}0-9_-]{1,30})/iu
  ]);
  if (nombre) result.nombre = title(nombre);

  const arete = firstMatch(raw, [
    /(?:el|su)?\s*(?:numero\s+de\s+)?arete\s+(?:es|sera|será|va\s+a\s+ser)\s+([A-Za-z0-9][A-Za-z0-9_.-]{1,49})/iu,
    /(?:va\s+a\s+tener|tendra|tendrá)\s+(?:el\s+)?arete\s+([A-Za-z0-9][A-Za-z0-9_.-]{1,49})/iu,
    /(?:numero\s+de\s+)?arete\s*[:#-]?\s*([A-Za-z]{1,6}[-_.]?\d{1,10})/iu,
    /\b([A-Za-z]{1,6}[-_.]?\d{2,10})\b/u
  ]);
  if (arete) result.numero_arete = arete.toUpperCase();

  const raza = firstMatch(raw, [
    /(?:su\s+)?raza\s+(?:es|sera|será)\s+([\p{L}]+(?:\s+[\p{L}]+)?)/iu,
    /\braza\s*[:#-]?\s*([\p{L}]+(?:\s+[\p{L}]+)?)/iu
  ]);
  if (raza) result.raza = title(raza);

  if (/\b(hembra|femenino|vaca)\b/.test(normalized)) result.sexo = "Hembra";
  if (/\b(macho|masculino|toro)\b/.test(normalized)) result.sexo = "Macho";

  if (!result.raza) {
    const breed = KNOWN_BREEDS.find((item) => new RegExp(`\\b${normalize(item)}\\b`, "u").test(normalized));
    if (breed) result.raza = title(breed);
  }

  const pieces = raw.split(/[,;|]+/).map(clean).filter(Boolean);
  for (const piece of pieces) {
    const value = validValue(piece.replace(/^(?:con\s+)?(?:sexo|raza|arete|nombre)\s*[:#-]?\s*/i, ""));
    if (!value) continue;
    const norm = normalize(value);
    if (!result.numero_arete && /^[A-Za-z]{1,6}[-_.]?\d{1,10}$/.test(value)) result.numero_arete = value.toUpperCase();
    else if (!result.sexo && /^(hembra|macho|femenino|masculino)$/.test(norm)) result.sexo = /hembra|femenino/.test(norm) ? "Hembra" : "Macho";
    else if (!result.raza && KNOWN_BREEDS.includes(norm)) result.raza = title(value);
    else if (!result.nombre && /^[\p{L}][\p{L}0-9_-]{1,30}$/u.test(value)) result.nombre = title(value);
  }

  return result;
}

export const __test = { normalize, validValue };
