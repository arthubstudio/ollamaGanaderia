import type { AgentContext } from "~/server/ai/context/agentContext";

export const TRANSACTIONAL_AGENT_PROMPT = `
Eres el agente transaccional de Ganaderia AI.
Usa solo las herramientas autorizadas y los datos del usuario autenticado.
No inventes nombres, aretes, vacunas, IDs ni parametros faltantes.
Usa el contexto reciente solo para resolver referencias a entidades ya mencionadas.
Nunca consultes RAG ni vuelvas a llamar al router.
`.trim();

export const AUTHORIZED_TRANSACTIONAL_TOOLS = new Set([
  "getPeso",
  "getEstado",
  "getEdad",
  "getVacunas",
  "getEnfermedades",
  "getHistorial",
  "getVenta",
  "getResumen",
  "crearBovino",
  "actualizarBovino",
  "eliminarBovino",
  "crearVacuna",
  "aplicarVacuna",
  "eliminarVacuna",
  "eliminarVacunaAplicada",
  "registrarPeso",
  "registrarEnfermedad",
  "actualizarEnfermedad",
  "eliminarEnfermedad",
  "transferirPropiedad",
  "quitarPropiedad",
  "crearDueno",
  "eliminarDueno",
  "crearRancho",
  "eliminarRancho"
]);

export type TransactionalAgentResult = {
  encontrado: boolean;
  tool: string | null;
  argumentos?: Record<string, unknown> | null;
  resultado?: unknown;
  respuesta: string;
};

export async function runTransactionalAgent(params: {
  event: any;
  message: string;
  usuarioId: number;
  conversationId?: string | null;
  context: AgentContext;
  directTool?: string;
  directArgs?: Record<string, unknown>;
}): Promise<TransactionalAgentResult> {
  if (params.directTool && !AUTHORIZED_TRANSACTIONAL_TOOLS.has(params.directTool)) {
    return {
      encontrado: false,
      tool: null,
      respuesta: "La herramienta solicitada no esta autorizada."
    };
  }

  const response = await params.event.$fetch("/api/ia/function-calling", {
    method: "POST",
    body: {
      pregunta: params.message,
      usuario_id: params.usuarioId,
      conversation_id: params.conversationId ?? null,
      historial: params.context.recentMessages,
      animal_context: params.context.lastBovino ?? null,
      direct_tool: params.directTool,
      direct_args: params.directArgs
    }
  });

  const tool = response?.tool ? String(response.tool) : null;
  if (tool && !AUTHORIZED_TRANSACTIONAL_TOOLS.has(tool)) {
    return {
      encontrado: false,
      tool: null,
      respuesta: "El modelo solicito una herramienta no autorizada."
    };
  }

  return response as TransactionalAgentResult;
}

