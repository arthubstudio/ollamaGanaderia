import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeIaText,
  normalizeIaText
} from "../lib/iaLanguageNormalizer.js";
import {
  buildCapabilityAnswer,
  detectCapabilityIntent,
  type IaCapabilityModule
} from "../lib/iaCapabilities";
import { routeIaMessage } from "../server/ai/agents/routerAgent";
import { __test as plannerTest } from "../lib/iaActionPlanner.js";

type CapabilityCase = {
  text: string;
  kind: "system" | "module" | "clarification";
  module?: IaCapabilityModule;
};

const requestedCases: CapabilityCase[] = [
  { text: "¿Qué hace un rancho?", kind: "module", module: "ranchos" },
  { text: "¿Qué es lo que hace este sistema?", kind: "system" },
  {
    text: "¿Qué puedo hacer con vacunas?",
    kind: "module",
    module: "vacunas"
  },
  {
    text: "¿Para qué sirve un dueño?",
    kind: "module",
    module: "duenos"
  },
  {
    text: "¿Qué puedo hacer con una vaca?",
    kind: "module",
    module: "bovinos"
  },
  { text: "¿Qué funciones tiene Ganadería AI?", kind: "system" },
  { text: "Que ase este sistema", kind: "system" },
  {
    text: "Que puedo aser con las bacunas",
    kind: "module",
    module: "vacunas"
  },
  {
    text: "Kiero saber para k sirve un rancho",
    kind: "module",
    module: "ranchos"
  },
  {
    text: "Como le pongo peso a una baca",
    kind: "module",
    module: "pesos"
  },
  {
    text: "K puedo acer con mis bovinos",
    kind: "module",
    module: "bovinos"
  }
];

test("normaliza faltas comunes sin usar el texto corregido como dato", () => {
  assert.equal(
    normalizeIaText("Que puedo aser con las bacunas"),
    "que puedo hacer con las vacunas"
  );
  assert.equal(
    normalizeIaText("Kiero saber para k sirve un rancho"),
    "quiero saber para que sirve un rancho"
  );
  assert.equal(
    normalizeIaText("Como le pongo peso a una baca"),
    "como le pongo peso a una vaca"
  );

  const source =
    'Transfiere la vaca "Mónica" a User2@Gmail.com con arete MX-0042 y 550 kg';
  const analysis = analyzeIaText(source);

  assert.equal(analysis.original, source);
  assert.ok(analysis.protectedValues.includes('"Mónica"'));
  assert.ok(analysis.protectedValues.includes("User2@Gmail.com"));
  assert.ok(analysis.protectedValues.includes("MX-0042"));
  assert.ok(analysis.protectedValues.includes("550"));
  assert.match(analysis.normalized, /User2@Gmail\.com/);
  assert.match(analysis.normalized, /MX-0042/);
});

test("detecta las preguntas de capacidades solicitadas", () => {
  for (const item of requestedCases) {
    const intent = detectCapabilityIntent(item.text);
    assert.ok(intent, item.text);
    assert.equal(intent.kind, item.kind, item.text);

    if (item.module) {
      assert.ok(intent.modules.includes(item.module), item.text);
    }

    const route = routeIaMessage(item.text);
    assert.equal(route.agent, "direct", item.text);
    assert.match(route.intent, /capabilities/, item.text);

    const answer = buildCapabilityAnswer(intent);
    assert.ok(answer.length > 40, item.text);
    assert.doesNotMatch(
      answer,
      /No encontr[eé] informaci[oó]n relacionada/i,
      item.text
    );
  }
});

test("conserva las formas de ayuda general que ya aceptaba el router", () => {
  for (const text of [
    "Ayuda",
    "help",
    "¿Cómo me ayudas?",
    "¿Cómo funcionas?",
    "¿Para qué sirves?",
    "¿En qué me puedes ayudar?",
    "¿Qué información manejas?",
    "¿Qué puedes consultar?"
  ]) {
    const intent = detectCapabilityIntent(text);
    assert.ok(intent, text);
    assert.equal(intent.kind, "system", text);
    assert.equal(routeIaMessage(text).intent, "system_capabilities", text);
  }
});

test("reconoce sinónimos y formas coloquiales por módulo", () => {
  const cases: Array<[string, IaCapabilityModule]> = [
    ["¿Qué puedo hacer con mis reses?", "bovinos"],
    ["¿Cómo uso mi hacienda?", "ranchos"],
    ["¿Qué opciones tengo para el kilaje?", "pesos"],
    ["¿Qué puedo hacer con mis padecimientos registrados?", "enfermedades"],
    ["¿Cómo uso el chat con mis contactos?", "mensajes"]
  ];

  for (const [text, expectedModule] of cases) {
    const intent = detectCapabilityIntent(text);
    assert.ok(intent, text);
    assert.equal(intent.kind, "module", text);
    assert.ok(intent.modules.includes(expectedModule), text);
  }
});

test("pide aclaración cuando la pregunta de ayuda no indica módulo", () => {
  const intent = detectCapabilityIntent("Que puedo hacer con eso");
  assert.ok(intent);
  assert.equal(intent.kind, "clarification");
  assert.match(buildCapabilityAnswer(intent), /bovinos.*vacunas.*mensajes/is);
  assert.equal(routeIaMessage("Que puedo hacer con eso").agent, "direct");
});

test("una pregunta específica de conocimiento sigue usando RAG", () => {
  const text = "¿Para qué sirve la vacuna Brucelosis?";
  assert.equal(detectCapabilityIntent(text), null);

  const route = routeIaMessage(text);
  assert.equal(route.agent, "rag");
  assert.equal(route.intent, "knowledge_query");
});

test("las preguntas de capacidades no se convierten en acciones", () => {
  for (const item of requestedCases) {
    assert.equal(plannerTest.extractAction(item.text), null, item.text);
  }
});

test("las intenciones transaccionales existentes permanecen intactas", () => {
  const messages = [
    "Registra una vaca llamada Luna, raza Brahman, sexo hembra",
    "Aplica la vacuna Brucelosis a Luna",
    "Transfiere la vaca Luna a user2@gmail.com",
    "Rejistra un bovino llamado Sol, raza Holstein, sexo hembra"
  ];

  for (const message of messages) {
    const route = routeIaMessage(message);
    assert.equal(route.agent, "transactional", message);
    assert.equal(route.intent, "database_write", message);
  }

  const action = plannerTest.extractAction(
    "Registra un bovino llamado Mónica, raza Brahman, sexo hembra"
  );
  assert.equal(action?.tool, "crearBovino");
  assert.equal(action?.args?.nombre, "Mónica");
});
