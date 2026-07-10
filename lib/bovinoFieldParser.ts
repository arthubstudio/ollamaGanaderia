import { extractBovinoEntities } from "~/lib/bovinoEntityExtractor.js";

export type ParsedBovinoFields = {
  numero_arete?: string;
  nombre?: string;
  raza?: string;
  sexo?: string;
};

export function parseBovinoFieldsFromText(text: string): ParsedBovinoFields | null {
  const parsed = extractBovinoEntities(text) as ParsedBovinoFields;
  return Object.keys(parsed).length ? parsed : null;
}
