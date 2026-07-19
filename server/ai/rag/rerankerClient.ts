import type { HybridSearchResult } from "~/server/ai/rag/hybridSearch";

type RerankerResponse = {
  results?: Array<{ index: number; score: number }>;
};

export async function rerankLocally(params: {
  query: string;
  documents: HybridSearchResult[];
  topK?: number;
  timeoutMs?: number;
}) {
  const endpoint = process.env.RERANKER_URL ?? "http://127.0.0.1:8010/rerank";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 10000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: params.query,
        documents: params.documents.map((document) => document.content)
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Reranker HTTP ${response.status}`);
    }

    const payload = await response.json() as RerankerResponse;
    if (!Array.isArray(payload.results)) {
      throw new Error("Respuesta invalida del reranker local.");
    }

    return payload.results
      .filter((item) => Number.isInteger(item.index) && params.documents[item.index])
      .sort((left, right) => Number(right.score) - Number(left.score))
      .slice(0, params.topK ?? 3)
      .map((item) => ({
        ...params.documents[item.index],
        rerankScore: Number(item.score) || 0
      }));
  } finally {
    clearTimeout(timeout);
  }
}

