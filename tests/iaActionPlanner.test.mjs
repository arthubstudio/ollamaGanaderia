import test from "node:test";
import assert from "node:assert/strict";
import { planIaTurn, __test } from "../lib/iaActionPlanner.js";
import { extractBovinoEntities } from "../lib/bovinoEntityExtractor.js";
import { formatAreteConsecutivo } from "../lib/areteFormat.js";

test("detecta conteo sin interpretar tengo como bovino", () => {
  const plan = planIaTurn({
    text: "Cuantos bovinos tengo.",
    pending: null
  });

  assert.equal(plan.kind, "query");
  assert.equal(plan.query.type, "count");
  assert.equal(plan.query.target, "bovinos");
  assert.equal(__test.extractAction("Cuantos bovinos tengo."), null);
});

test("consulta catalogo de vacunas por lenguaje natural", () => {
  const plan = planIaTurn({
    text: "Como se llaman mis vacunas?",
    pending: null
  });

  assert.equal(plan.kind, "query");
  assert.equal(plan.query.type, "list");
  assert.equal(plan.query.target, "vacunas_catalogo");
});

test("detecta conteo de ranchos", () => {
  const plan = planIaTurn({
    text: "Cuantos ranchos tengo",
    pending: null
  });

  assert.equal(plan.kind, "query");
  assert.equal(plan.query.type, "count");
  assert.equal(plan.query.target, "ranchos");
});

test("registra bovino incompleto conservando datos presentes", () => {
  const plan = planIaTurn({
    text: "Registra un bovino llamado Lulu.",
    pending: null
  });

  assert.equal(plan.kind, "pending");
  assert.equal(plan.pending.tool, "crearBovino");
  assert.equal(plan.pending.args.nombre, "Lulu");
  assert.deepEqual(plan.pending.missing, ["sexo", "raza"]);
});

test("completa una accion pendiente en varios turnos", () => {
  const first = planIaTurn({
    text: "Registra un bovino.",
    pending: null
  });

  assert.equal(first.kind, "pending");

  const second = planIaTurn({
    text: "Se llama Lulu.",
    pending: first.pending
  });

  assert.equal(second.kind, "pending");
  assert.equal(second.pending.args.nombre, "Lulu");
  assert.deepEqual(second.pending.missing, ["sexo", "raza"]);

  const third = planIaTurn({
    text: "Macho, raza Brahman.",
    pending: second.pending
  });

  assert.equal(third.kind, "pending");
  assert.equal(third.pending.awaitingConfirmation, true);
  assert.equal(third.pending.args.sexo, "Macho");
  assert.equal(third.pending.args.raza, "Brahman");
  assert.match(third.respuesta, /arete se generara automaticamente/i);
});

test("no ejecuta eliminacion sin confirmacion", () => {
  const plan = planIaTurn({
    text: "Elimina la vaca Lola.",
    pending: null
  });

  assert.equal(plan.kind, "pending");
  assert.equal(plan.pending.tool, "eliminarBovino");
  assert.equal(plan.pending.awaitingConfirmation, true);

  const confirmed = planIaTurn({
    text: "Si",
    pending: plan.pending
  });

  assert.equal(confirmed.kind, "execute");
  assert.equal(confirmed.tool, "eliminarBovino");
});

test("detecta acciones completas de catalogo y aplicacion de vacuna", () => {
  const rancho = planIaTurn({
    text: "Crea un rancho llamado Sur Maru.",
    pending: null
  });

  assert.equal(rancho.kind, "pending");
  assert.equal(rancho.pending.tool, "crearRancho");
  assert.equal(rancho.pending.args.nombre, "Sur Maru");
  assert.equal(rancho.pending.awaitingConfirmation, true);

  const vacunaIncompleta = planIaTurn({
    text: "Crea una vacuna.",
    pending: null
  });

  assert.equal(vacunaIncompleta.kind, "pending");
  assert.equal(vacunaIncompleta.pending.tool, "crearVacuna");
  assert.deepEqual(vacunaIncompleta.pending.missing, ["nombre"]);

  const vacunaCompleta = planIaTurn({
    text: "Crea una vacuna llamado Antiaftosa.",
    pending: null
  });
  assert.equal(vacunaCompleta.pending.args.nombre, "Antiaftosa");

  const aplicar = planIaTurn({
    text: "Aplica la vacuna Antiaftosa a Lola.",
    pending: null
  });

  assert.equal(aplicar.kind, "pending");
  assert.equal(aplicar.pending.tool, "aplicarVacuna");
  assert.equal(aplicar.pending.args.vacuna_nombre, "Antiaftosa");
  assert.equal(aplicar.pending.args.nombre_vaca, "Lola");
  assert.equal(aplicar.pending.awaitingConfirmation, true);
});

test("detecta contradiccion vaca macho", () => {
  const plan = planIaTurn({
    text: "Registra una vaca macho llamada Lola.",
    pending: null
  });

  assert.equal(plan.kind, "clarify");
});

test("extrae datos etiquetados sin usar conectores como valores", () => {
  const parsed = extractBovinoEntities(
    "El arete sera MX033, el nombre es Pepe, con sexo hembra y raza Brahman."
  );
  assert.deepEqual(parsed, {
    nombre: "Pepe",
    numero_arete: "MX033",
    raza: "Brahman",
    sexo: "Hembra"
  });
  assert.notEqual(parsed.nombre?.toLowerCase(), "es");
  assert.notEqual(parsed.numero_arete?.toLowerCase(), "sera");
});

test("extrae variantes naturales de nombre y arete", () => {
  assert.deepEqual(
    extractBovinoEntities("Su nombre va a ser Pepe y tendra el arete MX033."),
    { nombre: "Pepe", numero_arete: "MX033" }
  );
  assert.deepEqual(
    extractBovinoEntities("Se llama Pepe y es una hembra Brahman."),
    { nombre: "Pepe", raza: "Brahman", sexo: "Hembra" }
  );
  assert.deepEqual(
    extractBovinoEntities("Ponle Pepe, arete MX033, hembra, Brahman."),
    { nombre: "Pepe", numero_arete: "MX033", raza: "Brahman", sexo: "Hembra" }
  );
});

test("consulta venta de un bovino concreto sin inventar criterios", () => {
  const plan = planIaTurn({
    text: "La vaca Coco esta lista para venta?",
    pending: null
  });
  assert.equal(plan.kind, "query");
  assert.equal(plan.query.target, "venta_estado");
  assert.equal(plan.query.args.nombre, "Coco");
});

test("resuelve pronombre de peso con contexto estructurado y confirma", () => {
  const plan = planIaTurn({
    text: "Ponle un peso de 350 kg.",
    pending: null,
    context: {
      ultima_entidad: "bovino",
      ultimo_bovino_id: 123,
      ultimo_bovino_nombre: "Coco",
      ultima_intencion: "verificar_venta"
    }
  });
  assert.equal(plan.kind, "pending");
  assert.equal(plan.pending.tool, "registrarPeso");
  assert.equal(plan.pending.args.nombre, "Coco");
  assert.equal(plan.pending.args.peso, 350);
  assert.equal(plan.pending.awaitingConfirmation, true);
});

test("pide bovino cuando se cambia peso sin contexto", () => {
  const plan = planIaTurn({
    text: "Cambiale el peso a 300 kg.",
    pending: null
  });
  assert.equal(plan.kind, "pending");
  assert.equal(plan.pending.tool, "registrarPeso");
  assert.deepEqual(plan.pending.missing, ["nombre"]);
});

test("formatea aretes consecutivos con cuatro digitos", () => {
  assert.equal(formatAreteConsecutivo(1), "MX-0001");
  assert.equal(formatAreteConsecutivo(42), "MX-0042");
  assert.equal(formatAreteConsecutivo(9999), "MX-9999");
  assert.throws(() => formatAreteConsecutivo(10000), /ARETE_SEQUENCE_EXHAUSTED/);
});
