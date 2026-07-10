import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateVentaReadiness,
  PESO_MINIMO_VENTA_KG,
  VACUNAS_OBLIGATORIAS_VENTA
} from "../lib/ventaReadiness.js";

test("no determina venta cuando no existe peso", () => {
  const result = evaluateVentaReadiness({ nombre: "Monica", peso: null });
  assert.equal(result.lista, false);
  assert.match(result.respuesta, /no tiene un peso registrado/i);
});

test("indica peso actual y faltante cuando no alcanza 550 kg", () => {
  const result = evaluateVentaReadiness({
    nombre: "Monica",
    peso: 214,
    vacunasAplicadas: VACUNAS_OBLIGATORIAS_VENTA
  });
  assert.equal(PESO_MINIMO_VENTA_KG, 550);
  assert.equal(result.pesoFaltante, 336);
  assert.match(result.respuesta, /214 kg/);
  assert.match(result.respuesta, /550 kg/);
  assert.match(result.respuesta, /336 kg/);
});

test("muestra unicamente las vacunas obligatorias faltantes", () => {
  const result = evaluateVentaReadiness({
    nombre: "Monica",
    peso: 600,
    vacunasAplicadas: ["Brucelosis", "Rabia", "Vacuna opcional"]
  });
  assert.deepEqual(result.vacunasFaltantes, ["Clostridiales", "Complejo Respiratorio"]);
  assert.match(result.respuesta, /Clostridiales, Complejo Respiratorio/);
  assert.doesNotMatch(result.respuesta, /Vacuna opcional/);
});

test("declara listo solo con peso y cuatro vacunas completas", () => {
  const result = evaluateVentaReadiness({
    nombre: "Monica",
    peso: 550,
    vacunasAplicadas: ["rabia", "BRUCELOSIS", "Clostridiales", "Complejo Respiratorio"]
  });
  assert.equal(result.lista, true);
  assert.deepEqual(result.vacunasFaltantes, []);
  assert.match(result.respuesta, /esta listo para la venta/i);
});
