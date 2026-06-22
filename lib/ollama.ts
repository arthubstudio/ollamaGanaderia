import { Ollama } from "ollama";

const host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11435";

export const ollama = new Ollama({ host });
