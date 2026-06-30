import { normalizeRouterText, isRegistroBovinoDatos } from "~/lib/bovinoRouterHelpers";

const STOPWORDS_ANIMAL = new Set([
  "la", "el", "los", "las", "de", "del", "y", "o", "a", "al", "en", "que",
  "se", "su", "sus", "un", "una", "con", "por", "para", "le", "lo", "es",
  "son", "si", "no", "ya", "esta", "este", "estos", "estas", "estan",
  "lista", "listo", "listos", "listas", "apta", "apto", "aptos", "aptas",
  "puesta", "puestas", "puesto", "puestos", "tiene", "tienen", "hay",
  "cual", "cuales", "cuanta", "cuantas", "cuanto", "cuantos", "todas",
  "todos", "alguna", "alguno", "ninguna", "ninguno", "misma", "mismo"
]);

export function normalizeIntentText(value: string) {
  return normalizeRouterText(value);
}

export function isActionRequest(text: string) {
  const t = normalizeIntentText(text);

  const pideAccion =
    /\b(me gustaria|me gustaría|quisiera|quiero que|podrias|podrías|puedes|puedas|pueda|necesito que|ayudame a|ayúdame a|hazme|haz|favor de)\b/.test(
      t
    );

  const verboAccion =
    /\b(crear|crea|cree|crear|registrar|registra|agregar|agrega|eliminar|elimina|borrar|borra|actualizar|actualiza|modificar|aplicar|aplicale|transferir|transfiere|designar|designa|quitar|asignar|asignale|dar de alta)\b/.test(
      t
    );

  return pideAccion && verboAccion;
}

export function isQuestion(text: string) {
  const raw = (text ?? "").trim();
  if (raw.includes("?") || raw.includes("¿")) return true;

  const t = normalizeIntentText(text);

  if (
    /^(que|qué|cual|cuál|cuanto|cuánto|cuantos|cuántos|cuantas|cuántas|como|cómo|donde|dónde|quien|quién|cuales|cuáles|hay|tienes|tiene|tengo|puedo|puede|sabes|conoces|dime|muestrame|muéstrame|listame|listáme)\b/.test(
      t
    )
  ) {
    return true;
  }

  return /\b(tiene puesta|tienen puesta|tiene aplicada|tiene registrada|cuantas|cuantos|que vacuna|que vacunas|que enfermedad|que enfermedades|que peso|que raza|que dueño|que dueno|que rancho|esta lista|está lista|esta apta|está apta|listo para|lista para)\b/.test(
    t
  );
}

export function isGreeting(text: string) {
  const t = normalizeIntentText(text);

  return /^(hola|buenos dias|buenas tardes|buenas noches|buen dia|hey|saludos|que tal|qué tal|como estas|cómo estás|gracias|muchas gracias|adios|adiós|chao|hasta luego)([\s!.?]|$)/.test(
    t
  );
}

export function greetingResponse(text: string) {
  const t = normalizeIntentText(text);

  if (/gracias/.test(t)) {
    return "De nada. ¿En qué más puedo ayudarte con tu ganado?";
  }

  if (/adios|adiós|chao|hasta luego/.test(t)) {
    return "Hasta luego. Aquí estaré cuando necesites consultar o gestionar tu ganado.";
  }

  return "Hola. Soy Ganadería AI. Puedo consultar y gestionar bovinos, vacunas, enfermedades, dueños, ranchos y más. ¿Qué necesitas?";
}

export function isReadQuery(text: string) {
  const t = normalizeIntentText(text);

  if (isActionRequest(text)) return false;

  const consultaExplicita =
    isQuestion(text) ||
    /\b(dime|muestrame|muéstrame|listame|listáme|consulta|ver|mostrar|cuales son|cuáles son)\b/.test(
      t
    );

  if (!consultaExplicita) return false;

  const verbosEscritura =
    /\b(crear|crea|cree|registrar|registra|agregar|agrega|eliminar|elimina|borrar|borra|actualizar|actualiza|modificar|aplicar|aplicale|asignar|asignale|transferir|transfiere|designar|designa|quitar)\b/.test(
      t
    );

  return !verbosEscritura;
}

export function isVentaListQuery(text: string) {
  const t = normalizeIntentText(text);

  return (
    /\b(lista|listo|apta|apto|preparada|preparado)\b/.test(t) &&
    /\b(venta|vender|vendido|vendida|comercializ)\b/.test(t) &&
    /\b(que|qué|cual|cuál|cuales|cuáles|hay|tienes|tengo)\b/.test(t)
  );
}

export function isCountQuery(text: string) {
  const t = normalizeIntentText(text);

  return (
    /\b(cuantos|cuántos|cuantas|cuántas|total de|numero de|número de|cuento con)\b/.test(
      t
    ) &&
    /\b(bovino|bovinos|vaca|vacas|toro|toros|hembra|hembras|macho|machos|rancho|ranchos|dueno|dueño|duenos|dueños|vacuna|vacunas|enfermedad|enfermedades)\b/.test(
      t
    )
  );
}

export function extractCountTarget(text: string) {
  const t = normalizeIntentText(text);

  if (/\b(macho|machos|toro|toros)\b/.test(t)) return "machos";
  if (/\b(hembra|hembras|vaca|vacas)\b/.test(t) && !/\b(bovino|bovinos)\b/.test(t)) {
    return "hembras";
  }
  if (/\brancho/.test(t)) return "ranchos";
  if (/\b(dueno|dueño)/.test(t)) return "duenos";
  if (/\bvacuna/.test(t) && !/\b(aplicad|puesta|tiene)\b/.test(t)) return "vacunas_catalogo";
  if (/\benfermedad/.test(t)) return "enfermedades";
  if (/\b(bovino|bovinos|vaca|vacas|ganado)\b/.test(t)) return "bovinos";

  return "bovinos";
}

export function needsBovinoAssignment(text: string) {
  const t = normalizeIntentText(text);

  if (isCreateOnlyCatalog(text)) return false;

  return (
    /\b(aplicar|aplicale|aplicarle|asignar|asignale|asignarle|transferir|transfiere|transfierelo|transfierela|designar|designale|darle|ponerle|ponle|propiedad de|propiedad del|propiedad a)\b/.test(
      t
    ) ||
    (/\b(dueno|dueño|rancho)\b/.test(t) &&
      /\b(a la vaca|al bovino|a el bovino|a la hembra|al toro)\b/.test(t))
  );
}

export function isCreateOnlyCatalog(text: string) {
  const t = normalizeIntentText(text);

  const crea =
    /\b(crear|crea|cree|agregar|agrega|registrar|registra|nuevo|nueva|nuevo|dar de alta)\b/.test(
      t
    );
  const entidadCatalogo = /\b(rancho|ranchos|dueno|dueño|duenos|dueños|vacuna|vacunas)\b/.test(
    t
  );

  if (!crea || !entidadCatalogo) return false;

  if (needsBovinoAssignment(text)) return false;
  if (/\b(transferir|transferencia|propiedad)\b/.test(t)) return false;

  return true;
}

export function isDeleteAction(text: string) {
  const t = normalizeIntentText(text);
  return (
    /\b(eliminar|elimina|borrar|borra|quitar|quita|remover|remueve|suprimir|suprime)\b/.test(
      t
    ) && !isReadQuery(text)
  );
}

export function isUpdateAction(text: string) {
  const t = normalizeIntentText(text);
  return (
    /\b(actualizar|actualiza|modificar|modifica|cambiar|cambia|editar|edita|renombrar|renombra)\b/.test(
      t
    ) && !isReadQuery(text)
  );
}

export function isUnassignAction(text: string) {
  const t = normalizeIntentText(text);
  return (
    /\b(quitar|quita|desasignar|desasigna|designar|dejar de|sin rancho|sin dueno|sin dueño|remover rancho|remover dueno|remover dueño)\b/.test(
      t
    ) && /\b(rancho|dueno|dueño|propiedad|asignacion|asignación)\b/.test(t)
  );
}

export function isWriteActionIntent(text: string) {
  if (isReadQuery(text)) return false;
  if (isActionRequest(text)) return true;
  if (isDeleteAction(text)) return true;
  if (isUpdateAction(text)) return true;
  if (isUnassignAction(text)) return true;
  if (isCreateOnlyCatalog(text)) return true;

  if (isRegistroBovinoDatos(text)) return true;

  const t = normalizeIntentText(text);

  const writeVerbs = [
    "crea ",
    "crear ",
    "cree ",
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
    "asigna ",
    "asignar ",
    "inserta ",
    "insertar ",
    "transfiere ",
    "transferir ",
    "designa ",
    "designar ",
    "nueva vaca",
    "nuevo bovino",
    "nuevo rancho",
    "nuevo dueno",
    "nuevo dueño",
    "dar de alta"
  ];

  const writeTargets = [
    "vaca",
    "vacas",
    "bovino",
    "bovinos",
    "toro",
    "toros",
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
    "transferencia"
  ];

  const hasWriteVerb = writeVerbs.some((v) => t.includes(v));
  const hasTarget = writeTargets.some((w) => t.includes(w));

  if (needsBovinoAssignment(text) && (hasWriteVerb || hasTarget)) {
    return true;
  }

  return (hasWriteVerb && hasTarget) || isRegistroBovinoDatos(text);
}

export function isExplicitMemoryWrite(text: string) {
  if (isActionRequest(text)) return false;
  if (isWriteActionIntent(text)) return false;
  if (isReadQuery(text)) return false;
  if (isDeleteAction(text)) return false;
  if (isCountQuery(text)) return false;
  if (isGreeting(text)) return false;

  const raw = (text ?? "").trim();
  const normalized = normalizeIntentText(raw);

  const cleaned = raw
    .replace(/^recuerda que\s+/i, "")
    .replace(/^recuerda\s+/i, "")
    .trim();

  const cleanedNormalized = normalizeIntentText(cleaned);

  if (/^mi vaca favorita es\s+/.test(cleanedNormalized)) return true;
  if (/^(.+?)\s+es mi vaca favorita$/.test(cleanedNormalized)) return true;
  if (/^mi rancho favorito es\s+/.test(cleanedNormalized)) return true;
  if (/^mi proveedor favorito es\s+/.test(cleanedNormalized)) return true;
  if (/^mi (dueno|dueño) favorito es\s+/.test(cleanedNormalized)) return true;
  if (/^mi ([a-z0-9 _-]+?) favorito(?:a)? es\s+(.+)$/.test(cleanedNormalized)) {
    return true;
  }
  if (/^mi ([a-z0-9 _-]+?) es\s+(.+)$/.test(cleanedNormalized)) return true;

  if (/^(me gusta|me gustan|amo|adoro)\s+/.test(cleanedNormalized)) return true;
  if (/^(no me gusta|odio|detesto)\s+/.test(cleanedNormalized)) return true;
  if (/^prefiero\s+/.test(cleanedNormalized)) return true;
  if (/^(soy|me llamo)\s+/.test(cleanedNormalized)) return true;
  if (/^vivo en\s+/.test(cleanedNormalized)) return true;
  if (/^trabajo en\s+/.test(cleanedNormalized)) return true;
  if (/^(.+?)\s+odia\s+a\s+(.+)$/.test(cleanedNormalized)) return true;

  const factMatch = cleanedNormalized.match(
    /^(?:a\s+)?(.+?)\s+(le gusta|gusta|come|duerme|toma|prefiere|vive en|esta en|está en)\s+(.+)$/
  );
  if (factMatch) return true;

  if (
    normalized.startsWith("recuerda que ") ||
    normalized.startsWith("recuerda ") ||
    normalized.startsWith("mi ") ||
    normalized.startsWith("no me gusta") ||
    normalized.startsWith("odio") ||
    normalized.startsWith("prefiero") ||
    normalized.startsWith("soy ") ||
    normalized.startsWith("me llamo") ||
    normalized.startsWith("vivo en") ||
    normalized.startsWith("trabajo en")
  ) {
    return true;
  }

  return false;
}

export function isIncompleteAction(text: string) {
  const t = normalizeIntentText(text);

  if (isDeleteAction(text)) {
    const tieneEntidad =
      /\b(vaca|vacas|bovino|bovinos|toro|toros|vacuna|enfermedad|dueno|dueño|rancho)\b/.test(
        t
      );
    const tieneIdentificador =
      /\b(llamad[oa]|nombre|arete|n\s*[°º]?)\b/.test(t) ||
      /\b[a-z]{2,}\d|\d[a-z]/i.test(text) ||
      /\b(de la vaca|del bovino|del toro)\s+[a-z0-9_-]{2,}/i.test(text);

    if (tieneEntidad && !tieneIdentificador) {
      const matchAnimal = text.match(
        /\b(?:vaca|bovino|toro)\s+([a-z0-9_-]{2,})/i
      );
      if (matchAnimal?.[1] && !STOPWORDS_ANIMAL.has(normalizeIntentText(matchAnimal[1]))) {
        return null;
      }
      return "delete";
    }
  }

  if (isUnassignAction(text) && !/\b(lulu|[a-z]{3,})/i.test(text)) {
    return "unassign";
  }

  return null;
}

export function buildClarificationList(
  tipo: string,
  items: { id?: number; nombre?: string | null; numero_arete?: string | null; extra?: string }[]
) {
  if (!items.length) {
    return "No hay registros disponibles para esa acción.";
  }

  const encabezados: Record<string, string> = {
    delete: "¿Cuál deseas eliminar? Indica el nombre o arete:",
    unassign: "¿De cuál bovino deseas quitar la asignación? Indica el nombre:",
    update: "¿Cuál deseas actualizar? Indica el nombre o arete:"
  };

  const lista = items
    .map((item, i) => {
      const nombre = item.nombre ?? "Sin nombre";
      const arete = item.numero_arete ? ` (arete: ${item.numero_arete})` : "";
      const extra = item.extra ? ` — ${item.extra}` : "";
      return `${i + 1}. ${nombre}${arete}${extra}`;
    })
    .join("\n");

  return `${encabezados[tipo] ?? "Necesito más detalles. Elige una opción:"}\n\n${lista}`;
}
