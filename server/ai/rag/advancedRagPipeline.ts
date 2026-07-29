import { hybridSearch } from "~/server/ai/rag/hybridSearch";
import { rerankLocally } from "~/server/ai/rag/rerankerClient";
import { safeErrorDetails } from "~/server/utils/safeLogging";

export type RagMetrics = {
  retrievedCount: number;
  rerankedCount: number;
  rerankerUsed: boolean;
  retrievalLatencyMs: number;
  rerankLatencyMs: number;
  rerankerFallback?: string;
};

export async function runAdvancedRagPipeline(params: {
  query: string;
  usuarioId: number;
  retrieveTopK?: number;
  finalTopK?: number;
}) {
  const retrievalStart = Date.now();
  const retrieved = await hybridSearch({
    query: params.query,
    usuarioId: params.usuarioId,
    topK: params.retrieveTopK ?? 10
  });
  const retrievalLatencyMs = Date.now() - retrievalStart;

  const rerankStart = Date.now();
  let finalResults = retrieved.slice(0, params.finalTopK ?? 3);
  let rerankerUsed = false;
  let rerankerFallback: string | undefined;

  if (retrieved.length) {
    try {
      finalResults = await rerankLocally({
        query: params.query,
        documents: retrieved,
        topK: params.finalTopK ?? 3
      });
      rerankerUsed = true;
    } catch (error: any) {
      rerankerFallback = safeErrorDetails(error).error_code;
    }
  }

  const metrics: RagMetrics = {
    retrievedCount: retrieved.length,
    rerankedCount: finalResults.length,
    rerankerUsed,
    retrievalLatencyMs,
    rerankLatencyMs: Date.now() - rerankStart,
    ...(rerankerFallback ? { rerankerFallback } : {})
  };

  return {
    retrieved,
    results: finalResults,
    metrics
  };
}
