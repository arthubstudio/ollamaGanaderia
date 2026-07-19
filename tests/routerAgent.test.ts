import test from "node:test";
import assert from "node:assert/strict";
import { routeIaMessage } from "../server/ai/agents/routerAgent";

test("router envia escrituras y consultas concretas al agente transaccional", () => {
  assert.equal(
    routeIaMessage("Registra una vaca llamada Luna, raza Brahman").agent,
    "transactional"
  );
  assert.equal(
    routeIaMessage("Cuanto pesa la vaca Lola?").agent,
    "transactional"
  );
});

test("router envia conocimiento al agente RAG y saludos al directo", () => {
  assert.equal(
    routeIaMessage("Explica como prevenir la brucelosis bovina").agent,
    "rag"
  );
  assert.equal(routeIaMessage("Hola").agent, "direct");
});

test("router usa el historial reciente para seguimientos", () => {
  const route = routeIaMessage("Y como se previene?", [
    { role: "user", content: "Hablemos de salud de bovinos" }
  ]);
  assert.equal(route.agent, "rag");
  assert.equal(route.intent, "contextual_follow_up");
});

