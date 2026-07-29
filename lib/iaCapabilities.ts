import { normalizeIaText } from "~/lib/iaLanguageNormalizer.js";

export type IaCapabilityModule =
  | "bovinos"
  | "ranchos"
  | "duenos"
  | "vacunas"
  | "pesos"
  | "enfermedades"
  | "ventas"
  | "transferencias"
  | "amistades"
  | "mensajes";

export type IaCapabilityIntent = {
  kind: "system" | "module" | "clarification";
  modules: IaCapabilityModule[];
  confidence: number;
  normalizedText: string;
  reason: string;
};

type CapabilityDefinition = {
  title: string;
  aliases: string[];
  description: string;
  actions: string[];
};

export const IA_CAPABILITY_CATALOG: Record<
  IaCapabilityModule,
  CapabilityDefinition
> = {
  bovinos: {
    title: "Bovinos",
    aliases: [
      "bovino",
      "bovinos",
      "vaca",
      "vacas",
      "toro",
      "toros",
      "ganado"
    ],
    description:
      "Administra las vacas y toros de tu cuenta con un arete generado automáticamente.",
    actions: [
      "registrar, consultar, actualizar y eliminar bovinos",
      "consultar por nombre o número de arete",
      "ver su ficha, estado e historial relacionado"
    ]
  },
  ranchos: {
    title: "Ranchos",
    aliases: ["rancho", "ranchos"],
    description:
      "Representa las ubicaciones donde se administra el ganado.",
    actions: [
      "crear y consultar ranchos de tu cuenta",
      "consultar qué bovinos están relacionados con una ubicación",
      "conservar el rancho dentro del historial de propiedad"
    ]
  },
  duenos: {
    title: "Dueños",
    aliases: ["dueno", "duenos", "propiedad", "propiedades"],
    description:
      "La cuenta autenticada es la propietaria automática de los bovinos que registra.",
    actions: [
      "consultar la propiedad actual y su historial",
      "cambiar de cuenta propietaria mediante una solicitud de transferencia",
      "conservar vacunas, pesos y enfermedades cuando una transferencia se acepta"
    ]
  },
  vacunas: {
    title: "Vacunas",
    aliases: [
      "vacuna",
      "vacunas",
      "vacunacion",
      "vacunar",
      "vacuno"
    ],
    description:
      "Gestiona el catálogo de vacunas y las aplicaciones realizadas a cada bovino.",
    actions: [
      "crear y consultar vacunas del catálogo",
      "aplicar o quitar una vacuna de un bovino",
      "consultar fechas y registros de vacunación"
    ]
  },
  pesos: {
    title: "Pesos",
    aliases: [
      "peso",
      "pesos",
      "pesa",
      "pesar",
      "kg",
      "kilo",
      "kilos",
      "kilogramos"
    ],
    description:
      "Mantiene el historial de peso de cada bovino.",
    actions: [
      "registrar un peso con su fecha",
      "consultar el último peso disponible",
      "usar el peso real al verificar si un bovino está listo para venta"
    ]
  },
  enfermedades: {
    title: "Enfermedades",
    aliases: [
      "enfermedad",
      "enfermedades",
      "diagnostico",
      "diagnosticos",
      "tratamiento",
      "tratamientos",
      "salud"
    ],
    description:
      "Conserva diagnósticos, tratamientos y seguimiento sanitario por bovino.",
    actions: [
      "registrar, consultar, actualizar y eliminar enfermedades",
      "guardar tratamientos, fechas y veterinario",
      "consultar el historial sanitario sin inventar datos"
    ]
  },
  ventas: {
    title: "Ventas",
    aliases: [
      "venta",
      "ventas",
      "vender",
      "vendida",
      "vendido",
      "comercial"
    ],
    description:
      "Registra ventas y verifica requisitos de venta con datos reales.",
    actions: [
      "registrar y consultar ventas",
      "verificar el peso mínimo vigente de 380 kg",
      "mostrar únicamente las vacunas obligatorias faltantes"
    ]
  },
  transferencias: {
    title: "Transferencias",
    aliases: [
      "transferencia",
      "transferencias",
      "transferir",
      "transfiere",
      "traspasar",
      "enviar bovino"
    ],
    description:
      "Mueve un bovino entre cuentas mediante una solicitud que el receptor debe aceptar.",
    actions: [
      "enviar y consultar solicitudes de transferencia",
      "aceptar, rechazar o cancelar una solicitud autorizada",
      "mantener al dueño actual hasta que el receptor acepte"
    ]
  },
  amistades: {
    title: "Amistades",
    aliases: [
      "amistad",
      "amistades",
      "amigo",
      "amigos",
      "contacto",
      "contactos"
    ],
    description:
      "Conecta tu cuenta con otros usuarios antes de iniciar una conversación.",
    actions: [
      "buscar usuarios por nombre o correo",
      "enviar, aceptar o rechazar solicitudes de contacto",
      "consultar contactos y solicitudes"
    ]
  },
  mensajes: {
    title: "Mensajes",
    aliases: [
      "mensaje",
      "mensajes",
      "conversacion",
      "conversaciones",
      "mensajeria"
    ],
    description:
      "Permite conversar con contactos autorizados del sistema.",
    actions: [
      "enviar mensajes a un contacto",
      "leer y listar conversaciones",
      "mantener mensajes y estados de lectura en la cuenta correspondiente"
    ]
  }
};

export const IA_CLARIFICATION_RESPONSE =
  "No me queda claro qué parte del sistema quieres usar. ¿Te refieres a bovinos, ranchos, dueños, vacunas, pesos, enfermedades, ventas, transferencias, amistades o mensajes?";

export const IA_RAG_INSUFFICIENT_CONTEXT_RESPONSE =
  "No tengo contexto suficiente para responder con precisión. ¿Quieres una explicación general de un módulo o consultar un registro concreto de tu cuenta?";

const CAPABILITY_PATTERNS = [
  /\bque (?:es lo que )?(?:puedo|puedes|se puede) (?:hacer|realizar)\b/u,
  /\bque (?:es lo que )?hace\b/u,
  /\bpara que (?:me )?sirves?\b/u,
  /\b(?:que|cuales) (?:son )?(?:las )?(?:funciones|opciones|capacidades)\b/u,
  /\bcomo (?:se )?(?:usa|uso|utiliza|utilizo|funciona|funcionas)\b/u,
  /\bcomo (?:le |les )?(?:pongo|agrego|registro|anoto|aplico|quito|cambio|actualizo|creo|mando|envio|transfiero|vendo|vacuno)\b/u,
  /\bcomo (?:me )?(?:ayudas|puedes ayudar)\b/u,
  /\ben que (?:me )?puedes ayudar\b/u,
  /\bque (?:informacion|datos) (?:manejas|puedes consultar)\b/u,
  /\bque puedes consultar\b/u,
  /\bcomo me puedes (?:ser util|hacer util|hacer de utilidad)\b/u,
  /\bquiero saber (?:que|como|para que)\b/u,
  /^ayuda(?:me)?(?: con)?\b/u,
  /^help$/u
];

const SYSTEM_ALIASES =
  /\b(?:este|el|tu|la)?\s*(?:sistema|ganaderia ai|aplicacion|app|plataforma)\b/u;
const GENERAL_SYSTEM_HELP =
  /^(?:ayuda|ayudame|help)\s*$|\b(?:como (?:me )?(?:ayudas|puedes ayudar|puedes ser util|puedes hacer util|puedes hacer de utilidad)|en que (?:me )?puedes ayudar|para que (?:me )?sirves|que (?:informacion|datos) (?:manejas|puedes consultar)|que puedes consultar|como funcionas)\b/u;
const CONTEXT_ONLY =
  /\b(?:eso|esto|esa|ese|aquello|lo anterior|esa parte)\b/u;
const EXPLICIT_CAPABILITY =
  /\b(?:que (?:es lo que )?(?:puedo|puedes|se puede) (?:hacer|realizar)|funciones|opciones|capacidades)\b/u;
const SPECIFIC_ENTITY =
  /\b(?:vacuna|bovino|vaca|toro|rancho|dueno)\s+(?!de\b|del\b|que\b|para\b|con\b|sin\b|registrad[oa]\b|mis?\b|tus?\b)([\p{L}][\p{L}0-9_.-]{1,})/iu;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasAlias(text: string, alias: string) {
  return new RegExp(`(?:^|\\b)${escapeRegExp(alias)}(?:\\b|$)`, "iu").test(
    text
  );
}

export function detectCapabilityModules(
  value: string
): IaCapabilityModule[] {
  const text = normalizeIaText(value);

  if (
    /\bcomo\b.*\b(?:pongo|agrego|registro|anoto|cambio|actualizo)\b.*\b(?:peso|pesa|kg|kilo|kilos|kilogramos)\b/u.test(
      text
    )
  ) {
    return ["pesos"];
  }

  if (
    /\bcomo\b.*\b(?:aplico|quito|registro|vacuno)\b.*\b(?:vacuna|vacunas|vacunacion)\b/u.test(
      text
    )
  ) {
    return ["vacunas"];
  }

  return (Object.keys(IA_CAPABILITY_CATALOG) as IaCapabilityModule[]).filter(
    (module) =>
      IA_CAPABILITY_CATALOG[module].aliases.some((alias) =>
        hasAlias(text, alias)
      )
  );
}

export function detectCapabilityIntent(
  value: string
): IaCapabilityIntent | null {
  const normalizedText = normalizeIaText(value);
  if (!normalizedText) return null;
  if (/^(?:recuerda|guarda|anota que)\b/u.test(normalizedText)) return null;

  const hasCapabilityLanguage = CAPABILITY_PATTERNS.some((pattern) =>
    pattern.test(normalizedText)
  );
  const genericDefinition =
    /^que (?:es|son) (?:un|una|el|la|los|las)?\s*(?:bovino|bovinos|vaca|vacas|toro|toros|rancho|ranchos|dueno|duenos|vacuna|vacunas|peso|pesos|enfermedad|enfermedades|venta|ventas|transferencia|transferencias|amistad|amistades|mensaje|mensajes)\s*$/u.test(
      normalizedText
    );

  if (!hasCapabilityLanguage && !genericDefinition) return null;

  const modules = detectCapabilityModules(normalizedText);
  const targetsSystem =
    SYSTEM_ALIASES.test(normalizedText) ||
    GENERAL_SYSTEM_HELP.test(normalizedText);
  const asksExplicitCapabilities = EXPLICIT_CAPABILITY.test(normalizedText);

  if (
    SPECIFIC_ENTITY.test(normalizedText) &&
    !asksExplicitCapabilities &&
    !targetsSystem
  ) {
    return null;
  }

  if (!modules.length && CONTEXT_ONLY.test(normalizedText) && !targetsSystem) {
    return {
      kind: "clarification",
      modules: [],
      confidence: 0.82,
      normalizedText,
      reason:
        "La intención de ayuda es clara, pero el referente no identifica un módulo."
    };
  }

  if (targetsSystem || (!modules.length && asksExplicitCapabilities)) {
    return {
      kind: "system",
      modules: [],
      confidence: 0.99,
      normalizedText,
      reason:
        "La pregunta solicita las funciones generales de Ganadería AI."
    };
  }

  if (modules.length) {
    return {
      kind: "module",
      modules,
      confidence: modules.length === 1 ? 0.98 : 0.9,
      normalizedText,
      reason:
        "La pregunta solicita una explicación o las capacidades de uno o más módulos."
    };
  }

  if (hasCapabilityLanguage) {
    return {
      kind: "clarification",
      modules: [],
      confidence: 0.82,
      normalizedText,
      reason:
        "La intención de ayuda es clara, pero no se indicó un módulo."
    };
  }

  return null;
}

function moduleAnswer(module: IaCapabilityModule) {
  const capability = IA_CAPABILITY_CATALOG[module];
  const actions = capability.actions.map((action) => `- ${action}`).join("\n");
  return `${capability.title}\n${capability.description}\n\nPuedes:\n${actions}`;
}

export function buildCapabilityAnswer(intent: IaCapabilityIntent) {
  if (intent.kind === "clarification") {
    return IA_CLARIFICATION_RESPONSE;
  }

  if (intent.kind === "module") {
    return intent.modules.map(moduleAnswer).join("\n\n");
  }

  const modules = (
    Object.keys(IA_CAPABILITY_CATALOG) as IaCapabilityModule[]
  )
    .map((module) => {
      const item = IA_CAPABILITY_CATALOG[module];
      return `- ${item.title}: ${item.description}`;
    })
    .join("\n");

  return [
    "Ganadería AI te permite gestionar tu operación ganadera y consultar tus datos sin inventarlos.",
    "",
    "Módulos disponibles:",
    modules,
    "",
    "Puedes preguntarme, por ejemplo, qué puedes hacer con vacunas, pesos o transferencias."
  ].join("\n");
}
