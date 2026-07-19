const STOPWORDS = new Set([
  "a", "al", "algo", "como", "con", "cual", "cuales", "cuando", "de",
  "del", "el", "ella", "en", "es", "esta", "este", "explica", "explicame",
  "la", "las", "lo", "los", "me", "mi", "para", "por", "practicas", "que",
  "se", "sirve", "sirven", "son", "su", "sus", "un", "una", "y"
]);

export function buildPostgresTextQuery(value: string) {
  const tokens = String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]+/g) ?? [];

  const meaningful = [...new Set(tokens)]
    .filter((token) => token.length >= 3)
    .filter((token) => !STOPWORDS.has(token))
    .slice(0, 12);

  return meaningful.length ? meaningful.join(" | ") : "ganaderia";
}

