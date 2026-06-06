import ollama from "ollama";

export async function generarEmbedding(texto: string) {

  const response = await ollama.embeddings({

    model: "nomic-embed-text",

    prompt: texto

  });

  return response.embedding;

}