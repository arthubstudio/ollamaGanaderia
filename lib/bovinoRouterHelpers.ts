const STOPWORDS_NOMBRE = new Set([
  "la", "el", "los", "las", "de", "del", "y", "o", "a", "al", "en",
  "que", "se", "su", "sus", "un", "una", "unos", "unas", "mi", "mis",
  "tu", "tus", "le", "les", "lo", "es", "son", "con", "por", "para",
  "me", "te", "nos", "si", "no", "ya", "muy", "mundo", "mundial"
]);

export function normalizeRouterText(value: string) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isRegistroBovinoDatos(text: string) {
  const t = normalizeRouterText(text);

  const marcadores = [
    "numero de arete",
    "numero del arete",
    "numero dela rete",
    "n del arete",
    "n de arete",
    "el nombre es",
    "nombre es",
    "mi raza",
    "la raza es",
    "raza es",
    "sexo "
  ];

  const marcadoresEncontrados = marcadores.filter((m) => t.includes(m)).length;

  if (marcadoresEncontrados >= 2) return true;

  if (
    marcadoresEncontrados >= 1 &&
    (t.includes("vaca") || t.includes("bovino") || t.includes("toro"))
  ) {
    return true;
  }

  if (
    t.includes("faltan datos") ||
    t.includes("numero arete") ||
    t.includes("arete,")
  ) {
    return false;
  }

  return false;
}

export function isWriteActionBovino(text: string) {
  const t = normalizeRouterText(text);

  const writeVerbs = [
    "crea ",
    "crear ",
    "agrega ",
    "agregar ",
    "anade ",
    "anadir ",
    "registra ",
    "registrar ",
    "aplica ",
    "aplicar ",
    "aplicale ",
    "aplicarle ",
    "asignale ",
    "asignarle ",
    "inserta ",
    "insertar ",
    "nueva vaca",
    "nuevo bovino",
    "nueva bovino",
    "nuevo ",
    "dar de alta"
  ];

  const writeTargets = [
    "vaca",
    "vacas",
    "bovino",
    "bovinos",
    "toro",
    "toros",
    "semental",
    "sementales",
    "vacuna",
    "vacunas",
    "peso",
    "enfermedad",
    "enfermedades",
    "dueno",
    "dueño",
    "duenos",
    "dueños",
    "rancho",
    "ranchos",
    "propiedad",
    "transferencia",
    "transferir"
  ];

  const hasWriteVerb = writeVerbs.some((v) => t.includes(v));
  const hasTarget = writeTargets.some((w) => t.includes(w));

  return (hasWriteVerb && hasTarget) || isRegistroBovinoDatos(text);
}

function esNombreValido(token: string) {
  if (!token || token.length < 2) return false;
  if (STOPWORDS_NOMBRE.has(token)) return false;
  if (/^\d+$/.test(token)) return false;
  return true;
}

export function extraerConsultaEspecificaBovino(texto: string) {
  const t = normalizeRouterText(texto);

  if (isWriteActionBovino(texto)) return null;
  if (isRegistroBovinoDatos(texto)) return null;

  if (/\b(vaca|bovino)\s+llamad[oa]\s+/i.test(t)) return null;

  if (
    /vaca[s]?\s+favorita[s]?/.test(t) ||
    /bovino[s]?\s+favorito[s]?/.test(t) ||
    /rancho[s]?\s+favorito[s]?/.test(t) ||
    /proveedor[s]?\s+favorito[s]?/.test(t)
  ) {
    return null;
  }

  const patterns = [
    /\bde la (?:vaca|bovino)\s+([a-z0-9_-]+)/i,
    /\bde (?:vaca|bovino)\s+([a-z0-9_-]+)/i,
    /\bmi (?:vaca|bovino)\s+([a-z0-9_-]+)/i,
    /\b(?:vaca|bovino)\s+([a-z0-9_-]+)/i,
    /\barete\s+([a-z0-9_-]+)/i
  ];

  for (const pattern of patterns) {
    const match = t.match(pattern);
    const token = match?.[1];
    if (token && esNombreValido(token)) return token;
  }

  return null;
}

export function mensajeRegistroBovinoInvalido(texto: string): string | null {
  if (!isRegistroBovinoDatos(texto)) return null;

  return [
    "No pude registrar el bovino con ese texto.",
    "Necesito datos cortos y concretos, uno por campo:",
    "• Arete (ej. A-101)",
    "• Nombre (ej. Lola)",
    "• Raza (ej. Holstein)",
    "• Sexo: Hembra (vaca) o Macho (toro)",
    "Una vaca siempre es hembra; un toro siempre es macho."
  ].join("\n");
}
