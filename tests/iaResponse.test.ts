import assert from "node:assert/strict";
import test from "node:test";
import { normalizeIaAnswer, withIaAnswer } from "../lib/iaResponse";

test("normaliza respuesta heredada al contrato answer", () => {
  const response = withIaAnswer({ respuesta: "Accion completada.", encontrado: true });
  assert.equal(response.answer, "Accion completada.");
  assert.equal(response.respuesta, "Accion completada.");
});

test("prioriza answer y nunca devuelve texto vacio", () => {
  assert.equal(
    normalizeIaAnswer({ answer: "Respuesta final", respuesta: "Anterior" }),
    "Respuesta final"
  );
  assert.match(normalizeIaAnswer({ respuesta: "   " }), /servidor de IA.*sin devolver una respuesta/i);
});
