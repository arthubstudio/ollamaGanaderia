export function memoryToUserPerspective(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return "";

  const replacements = [
    [/^yo\s+soy\s+/i, "eres "],
    [/^soy\s+/i, "eres "],
    [/^yo\s+me\s+llamo\s+/i, "te llamas "],
    [/^me\s+llamo\s+/i, "te llamas "],
    [/^yo\s+tengo\s+/i, "tienes "],
    [/^tengo\s+/i, "tienes "],
    [/^yo\s+vivo\s+en\s+/i, "vives en "],
    [/^vivo\s+en\s+/i, "vives en "],
    [/^yo\s+trabajo\s+en\s+/i, "trabajas en "],
    [/^trabajo\s+en\s+/i, "trabajas en "],
    [/^yo\s+prefiero\s+/i, "prefieres "],
    [/^prefiero\s+/i, "prefieres "],
    [/^a\s+mi\s+me\s+gusta\s+/i, "te gusta "],
    [/^me\s+gusta\s+/i, "te gusta "],
    [/^me\s+gustan\s+/i, "te gustan "],
    [/^no\s+me\s+gusta\s+/i, "no te gusta "],
    [/^yo\s+odio\s+/i, "odias "],
    [/^odio\s+/i, "odias "],
    [/^yo\s+amo\s+/i, "amas "],
    [/^amo\s+/i, "amas "],
    [/^yo\s+adoro\s+/i, "adoras "],
    [/^adoro\s+/i, "adoras "],
    [/^mi\s+/i, "tu "],
    [/^mis\s+/i, "tus "]
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(raw)) return raw.replace(pattern, replacement).trim();
  }

  return raw;
}

export function memoryConfirmation(text) {
  return `Entendido, recordare que ${memoryToUserPerspective(text)}.`;
}
