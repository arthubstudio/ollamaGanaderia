import {
  detectCapabilityIntent
} from "~/lib/iaCapabilities";
import { normalizeIaText } from "~/lib/iaLanguageNormalizer.js";

export type AgentName = "rag" | "transactional" | "direct";

export type AgentRoute = {
  agent: AgentName;
  intent: string;
  confidence: number;
  reason: string;
};

type RecentMessage = {
  role: string;
  content: string;
};

const WRITE_PATTERN = /\b(crea|crear|registra|registrar|registrale|agrega|agregar|agregale|anade|anadir|aplica|aplicar|aplicale|vacunar|vacunale|actualiza|actualizar|actualizale|modifica|modificar|cambia|cambiar|cambiale|transfiere|transfiera|transferir|manda|mandar|mandale|envia|enviar|enviale|pasa|pasar|traspasa|traspasar|acepta|aceptar|rechaza|rechazar|cancela|cancelar|asigna|asignar|elimina|eliminar|borra|borrar|quita|quitar|anota|anotar|anotale|ponle|captura|capturar|da de alta|dar de alta)\b/;
const DATA_TARGET_PATTERN = /\b(bovino|bovinos|vaca|vacas|toro|toros|ganado|peso|pesos|vacuna|vacunas|vacunacion|enfermedad|enfermedades|brucelosis|clostridial|clostridiales|respiratorio|salud|nutricion|alimentacion|bioseguridad|rancho|ranchos|dueno|duenos|arete|venta|ventas|propiedad|historial|transferencia|transferencias|usuario|usuarios|raza|razas|contacto|contactos|amigo|amigos|amistad|mensaje|mensajes|conversacion|conversaciones|notificacion|notificaciones)\b/;
const DATABASE_QUERY_PATTERN = /\b(cuantos|cuantas|lista|listar|enlista|dame|disponibles|registradas|muestra|muestrame|tengo|tiene|pesa|peso de|vacunas de|enfermedades de|estado de|historial de|busca|buscar|consulta|consultar|ver|arete|listo para venta|lista para venta|recibidos|enviados|conversaciones|contactos|razas)\b/;
const KNOWLEDGE_PATTERN = /\b(que es|que son|que significa|como funciona|como prevenir|como tratar|explica|explicame|recomendaciones|manejo|sintomas|causas|cuidados|salud|nutricion|alimentacion|calendario|por que|para que sirve|buenas practicas|informacion general)\b/;
const MEMORY_QUERY_PATTERN = /\b(que recuerdas|que sabes de mi|mis memorias|mi preferencia|recuerdas de mi)\b/;
const MEMORY_WRITE_PATTERN = /^(recuerda(?: que)?|soy |me llamo |vivo en |trabajo en |me gusta |no me gusta |prefiero |mi .+ es )/;
const DIRECT_PATTERN = /^(hola|buenos dias|buenas tardes|buenas noches|gracias|adios|hasta luego|ayuda|que puedes hacer)[!.? ]*$/;

export function routeIaMessage(
  message: string,
  recentMessages: RecentMessage[] = []
): AgentRoute {
  const text = normalizeIaText(message);

  if (!text) {
    return {
      agent: "direct",
      intent: "empty_message",
      confidence: 1,
      reason: "El mensaje no contiene texto util."
    };
  }

  const capabilityIntent = detectCapabilityIntent(message);
  if (capabilityIntent) {
    return {
      agent: "direct",
      intent:
        capabilityIntent.kind === "system"
          ? "system_capabilities"
          : capabilityIntent.kind === "module"
            ? "module_capabilities"
            : "capability_clarification",
      confidence: capabilityIntent.confidence,
      reason: capabilityIntent.reason
    };
  }

  if (DIRECT_PATTERN.test(text)) {
    return {
      agent: "direct",
      intent: text.includes("ayuda") || text.includes("puedes hacer")
        ? "help"
        : "small_talk",
      confidence: 0.99,
      reason: "Regla determinista para saludo, ayuda o mensaje trivial."
    };
  }

  if (MEMORY_WRITE_PATTERN.test(text)) {
    return {
      agent: "transactional",
      intent: "memory_write",
      confidence: 0.96,
      reason: "La solicitud guarda o actualiza una memoria del usuario."
    };
  }

  if (WRITE_PATTERN.test(text) && DATA_TARGET_PATTERN.test(text)) {
    return {
      agent: "transactional",
      intent: "database_write",
      confidence: 0.98,
      reason: "Se detecto un verbo de escritura sobre una entidad autorizada."
    };
  }

  if (DATABASE_QUERY_PATTERN.test(text) && DATA_TARGET_PATTERN.test(text)) {
    return {
      agent: "transactional",
      intent: "database_query",
      confidence: 0.95,
      reason: "La pregunta solicita datos concretos de PostgreSQL."
    };
  }

  if (MEMORY_QUERY_PATTERN.test(text)) {
    return {
      agent: "rag",
      intent: "memory_query",
      confidence: 0.96,
      reason: "La respuesta requiere recuperar memorias del usuario."
    };
  }

  if (KNOWLEDGE_PATTERN.test(text) && DATA_TARGET_PATTERN.test(text)) {
    return {
      agent: "rag",
      intent: "knowledge_query",
      confidence: 0.93,
      reason: "La pregunta es explicativa y pertenece al dominio ganadero."
    };
  }

  const contextText = normalizeIaText(
    recentMessages.slice(-4).map((item) => item.content).join(" ")
  );
  const contextualReference = /\b(eso|esa|ese|ella|el anterior|lo anterior|dime mas|y por que|y como)\b/.test(text);

  if (contextualReference && DATA_TARGET_PATTERN.test(contextText)) {
    return {
      agent: "rag",
      intent: "contextual_follow_up",
      confidence: 0.78,
      reason: "El mensaje continua una pregunta ganadera reciente."
    };
  }

  if (DATA_TARGET_PATTERN.test(text)) {
    return {
      agent: "rag",
      intent: "domain_query",
      confidence: 0.72,
      reason: "El mensaje pertenece al dominio ganadero sin una operacion concreta."
    };
  }

  return {
    agent: "direct",
    intent: "clarification_needed",
    confidence: 0.75,
    reason: "No se detecto una intencion suficientemente clara para actuar."
  };
}
