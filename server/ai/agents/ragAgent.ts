import { ollama } from "~/lib/ollama";
import type { AgentContext } from "~/server/ai/context/agentContext";
import { runAdvancedRagPipeline } from "~/server/ai/rag/advancedRagPipeline";

export async function runRagAgent(params: {
  query: string;
  usuarioId: number;
  context: AgentContext;
  stream?: boolean;
  onToken?: (token: string) => void;
}) {
  const pipeline = await runAdvancedRagPipeline({
    query: params.query,
    usuarioId: params.usuarioId,
    retrieveTopK: 10,
    finalTopK: 3
  });

  const retrievedContext = pipeline.results.map((result) => ({
    id: result.id,
    source: result.source,
    content: result.content,
    vectorScore: result.vectorScore,
    textScore: result.textScore,
    fusedScore: result.fusedScore,
    ...(typeof (result as any).rerankScore === "number"
      ? { rerankScore: (result as any).rerankScore }
      : {})
  }));

  const contextText = retrievedContext.length
    ? retrievedContext
        .map((result, index) => `[${index + 1}] ${result.source}: ${result.content}`)
        .join("\n\n")
    : "Sin contexto recuperado.";

  const messages = [
    {
      role: "system" as const,
      content: `
Eres el agente RAG de Ganaderia AI.
Responde solo con el contexto recuperado y el historial reciente proporcionado.
No ejecutes acciones ni escrituras. No inventes datos, animales, vacunas o hechos.
Si el contexto no contiene la respuesta, indica que no encontraste informacion suficiente.
Responde de forma breve, clara y en espanol.
`.trim()
    },
    {
      role: "user" as const,
      content: `CONTEXTO RECUPERADO:\n${contextText}`
    },
    ...params.context.recentMessages.slice(-6),
    {
      role: "user" as const,
      content: params.query
    }
  ];

  let answer = "";
  let firstTokenAt: number | null = null;
  const generationStart = Date.now();

  if (params.stream) {
    const stream = await ollama.chat({
      model: process.env.CHAT_MODEL ?? "llama3.2:latest",
      stream: true,
      options: { temperature: 0, top_p: 0.1 },
      messages
    });

    for await (const chunk of stream as any) {
      const token = String(chunk.message?.content ?? "");
      if (!token) continue;
      if (firstTokenAt === null) firstTokenAt = Date.now();
      answer += token;
      params.onToken?.(token);
    }
  } else {
    const response = await ollama.chat({
      model: process.env.CHAT_MODEL ?? "llama3.2:latest",
      stream: false,
      options: { temperature: 0, top_p: 0.1 },
      messages
    });
    answer = String(response.message?.content ?? "").trim();
  }

  return {
    answer: answer || "No encontre informacion suficiente en el sistema.",
    retrievedContext,
    metrics: {
      ...pipeline.metrics,
      ttftMs: firstTokenAt ? firstTokenAt - generationStart : 0
    }
  };
}

