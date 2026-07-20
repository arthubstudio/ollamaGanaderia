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

test("router envia cualquier verbo de transferencia al agente transaccional", () => {
  for (const verbo of ["Transfiere", "Envia", "Manda", "Pasa", "Traspasa"]) {
    const route = routeIaMessage(`${verbo} la vaca Bolita a user1`);
    assert.equal(route.agent, "transactional", verbo);
    assert.equal(route.intent, "database_write", verbo);
  }
});

test("router reconoce quiero que transfiera como escritura", () => {
  const route = routeIaMessage("quiero que transfiera el bovino Bolita a user2@gmail.com");
  assert.equal(route.agent, "transactional");
  assert.equal(route.intent, "database_write");
});

test("router usa el historial reciente para seguimientos", () => {
  const route = routeIaMessage("Y como se previene?", [
    { role: "user", content: "Hablemos de salud de bovinos" }
  ]);
  assert.equal(route.agent, "rag");
  assert.equal(route.intent, "contextual_follow_up");
});
