import { ollama } from "~/lib/ollama";

export async function generarEmbedding(texto: string) {
  const response = await ollama.embeddings({
    model: "nomic-embed-text",
    prompt: texto
  });

  return response.embedding;
}

export async function generarEmbeddingSafe(
  texto: string
): Promise<number[] | null> {
  try {
    return await generarEmbedding(texto);
  } catch {
    return null;
  }
}