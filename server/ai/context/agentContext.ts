import { matchAnimalInText } from "~/lib/conversationContext";

export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentContext = {
  conversationId?: string;
  recentMessages: AgentMessage[];
  lastBovino?: {
    id?: number;
    nombre?: string;
    numero_arete?: string;
  };
  lastVacuna?: string;
  lastAction?: string;
  lastOwner?: string;
  lastRancho?: string;
};

type BovinoRef = {
  id?: number;
  nombre?: string | null;
  numero_arete?: string | null;
};

type ConversationState = {
  ultimo_bovino_id?: number;
  ultimo_bovino_nombre?: string;
  ultima_intencion?: string;
} | null;

function cleanEntity(value: string | undefined) {
  return String(value ?? "")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

function findLastMatch(messages: AgentMessage[], pattern: RegExp) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const match = messages[index]?.content.match(pattern);
    if (match?.[1]) return cleanEntity(match[1]);
  }
  return undefined;
}

export function buildAgentContext(params: {
  conversationId?: string | null;
  recentMessages?: Array<{ role: string; content: string }>;
  currentMessage?: string;
  bovinos?: BovinoRef[];
  conversationState?: ConversationState;
}): AgentContext {
  const recentMessages = (params.recentMessages ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-8)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: String(message.content ?? "").slice(0, 2000)
    }));

  const searchable = [
    ...recentMessages,
    ...(params.currentMessage
      ? [{ role: "user" as const, content: params.currentMessage }]
      : [])
  ];

  let lastBovino: AgentContext["lastBovino"];
  const bovinos = params.bovinos ?? [];

  for (let index = searchable.length - 1; index >= 0 && !lastBovino; index -= 1) {
    const match = matchAnimalInText(searchable[index]?.content ?? "", bovinos);
    if (match) {
      lastBovino = {
        id: match.id,
        nombre: match.nombre ?? undefined,
        numero_arete: match.numero_arete ?? undefined
      };
    }
  }

  if (!lastBovino && params.conversationState?.ultimo_bovino_nombre) {
    lastBovino = {
      id: params.conversationState.ultimo_bovino_id,
      nombre: params.conversationState.ultimo_bovino_nombre
    };
  }

  const lastVacuna = findLastMatch(
    searchable,
    /vacuna\s+(?:llamada\s+|de nombre\s+)?["“]?([\p{L}0-9][\p{L}0-9 _-]{1,60}?)["”]?(?:\s+(?:a|al|para|en)\b|[.,;!?]|$)/iu
  );
  const lastOwner = findLastMatch(
    searchable,
    /(?:dueno|dueño)\s+(?:llamado\s+|de nombre\s+)?["“]?([\p{L}0-9][\p{L}0-9 _-]{1,60})/iu
  );
  const lastRancho = findLastMatch(
    searchable,
    /rancho\s+(?:llamado\s+|de nombre\s+)?["“]?([\p{L}0-9][\p{L}0-9 _-]{1,60})/iu
  );
  const lastAction = params.conversationState?.ultima_intencion ?? findLastMatch(
    searchable,
    /\b(crear|registrar|aplicar|actualizar|transferir|eliminar|consultar)\b/iu
  );

  return {
    ...(params.conversationId ? { conversationId: params.conversationId } : {}),
    recentMessages,
    ...(lastBovino ? { lastBovino } : {}),
    ...(lastVacuna ? { lastVacuna } : {}),
    ...(lastAction ? { lastAction } : {}),
    ...(lastOwner ? { lastOwner } : {}),
    ...(lastRancho ? { lastRancho } : {})
  };
}

