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

test("indica peso actual y faltante cuando no alcanza 380 kg", () => {
  const result = evaluateVentaReadiness({
    nombre: "Monica",
    peso: 214,
    vacunasAplicadas: VACUNAS_OBLIGATORIAS_VENTA
  });
  assert.equal(PESO_MINIMO_VENTA_KG, 380);
  assert.equal(result.pesoFaltante, 166);
  assert.match(result.respuesta, /214 kg/);
  assert.match(result.respuesta, /380 kg/);
  assert.match(result.respuesta, /166 kg/);
});

test("muestra unicamente las vacunas obligatorias faltantes", () => {
  const result = evaluateVentaReadiness({
    nombre: "Monica",
    peso: 600,
    vacunasAplicadas: ["Brucelosis", "Vacuna opcional"]
  });
  assert.deepEqual(result.vacunasFaltantes, [
    "Rabia Paralítica Bovina",
    "Carbón Sintomático (Pierna Negra) y Edema Maligno"
  ]);
  assert.deepEqual(result.vacunasCumplidas, ["Brucelosis"]);
  assert.match(result.respuesta, /Rabia Paralítica Bovina/);
  assert.match(result.respuesta, /Carbón Sintomático/);
  assert.doesNotMatch(result.respuesta, /Vacuna opcional/);
});

test("declara listo solo con 380 kg y las tres vacunas completas", () => {
  const result = evaluateVentaReadiness({
    nombre: "Monica",
    peso: 380,
    vacunasAplicadas: [
      "BRUCELOSIS",
      "rabia paralítica bovina",
      "Carbón Sintomático (Pierna Negra) y Edema Maligno"
    ]
  });
  assert.equal(result.lista, true);
  assert.deepEqual(result.vacunasFaltantes, []);
  assert.match(result.respuesta, /esta listo para la venta/i);
});
