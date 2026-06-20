const blockedPatterns = [

  "ignore previous instructions",
  "ignora las instrucciones",
  "system prompt",
  "developer mode",
  "jailbreak",
  "act as",
  "dan mode",
  "reveal prompt"

];

export function detectPromptInjection(
  prompt: string
) {

  const lower =
    prompt.toLowerCase();

  return blockedPatterns.some(
    p => lower.includes(p)
  );

}