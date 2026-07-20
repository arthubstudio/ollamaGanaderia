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

test("registra peso con las variantes naturales solicitadas", () => {
  for (const text of [
    "Al bovino Carlota agrégale un peso de 345 kg",
    "Ponle 345 kg de peso a Carlota",
    "Registra 345 de peso al bovino Carlota"
  ]) {
    const plan = planIaTurn({ text, pending: null });
    assert.equal(plan.kind, "pending", text);
    assert.equal(plan.pending.tool, "registrarPeso", text);
    assert.equal(plan.pending.args.nombre, "Carlota", text);
    assert.equal(plan.pending.args.peso, 345, text);
    assert.equal(plan.pending.awaitingConfirmation, true, text);
  }
});

test("aplicar una vacuna nunca se confunde con crear bovino", () => {
  const plan = planIaTurn({
    text: "Al bovino Carlota agrégale la vacuna Brucelosis",
    pending: null
  });
  assert.equal(plan.kind, "pending");
  assert.equal(plan.pending.tool, "aplicarVacuna");
  assert.equal(plan.pending.args.nombre_vaca, "Carlota");
  assert.equal(plan.pending.args.vacuna_nombre, "Brucelosis");
});

test("cambia de tema y cancela el contexto pendiente", () => {
  const pending = {
    tool: "crearBovino",
    args: { nombre: "Luna" },
    missing: ["sexo", "raza"],
    awaitingConfirmation: false
  };
  const vaccine = planIaTurn({
    text: "Aplica la vacuna Brucelosis a Carlota",
    pending
  });
  assert.equal(vaccine.pending.tool, "aplicarVacuna");
  assert.equal(vaccine.pending.args.nombre_vaca, "Carlota");
  assert.equal(vaccine.pending.args.sexo, undefined);

  const breeds = planIaTurn({ text: "Dame las razas disponibles", pending });
  assert.equal(breeds.kind, "query");
  assert.equal(breeds.query.tool, "listarRazas");
  assert.equal(breeds.clearPending, true);
});

test("un si sin accion pendiente no ejecuta ninguna tool", () => {
  const plan = planIaTurn({ text: "Sí", pending: null });
  assert.equal(plan.kind, "clarify");
  assert.match(plan.respuesta, /no hay una accion pendiente/i);
});

test("formatea aretes consecutivos con cuatro digitos", () => {
  assert.equal(formatAreteConsecutivo(1), "MX-0001");
  assert.equal(formatAreteConsecutivo(42), "MX-0042");
  assert.equal(formatAreteConsecutivo(9999), "MX-9999");
  assert.throws(() => formatAreteConsecutivo(10000), /ARETE_SEQUENCE_EXHAUSTED/);
});

test("planea transferencia entre cuentas y exige confirmacion", () => {
  const result = planIaTurn({
    text: "Manda la vaca Lola al usuario Carlos",
    pending: null
  });
  assert.equal(result.kind, "pending");
  assert.equal(result.pending.tool, "crearSolicitudTransferencia");
  assert.equal(result.pending.args.nombre_bovino, "Lola");
  assert.equal(result.pending.args.usuario_destino, "Carlos");
  assert.equal(result.pending.awaitingConfirmation, true);
});

test("todos los verbos de transferencia usan una solicitud entre cuentas", () => {
  for (const verbo of ["Transfiere", "Envia", "Manda", "Pasa", "Traspasa"]) {
    const result = planIaTurn({
      text: `${verbo} la vaca Bolita a user1`,
      pending: null
    });

    assert.equal(result.kind, "pending", verbo);
    assert.equal(result.pending.tool, "crearSolicitudTransferencia", verbo);
    assert.equal(result.pending.args.nombre_bovino, "Bolita", verbo);
    assert.equal(result.pending.args.usuario_destino, "User1", verbo);
    assert.equal(result.pending.awaitingConfirmation, true, verbo);
  }
});

test("extrae transferencia en subjuntivo por username o correo", () => {
  const cases = [
    ["quiero que transfiera el bovino Bolita a user2", "User2"],
    ["quiero que transfiera el bovino Bolita a user2@gmail.com", "user2@gmail.com"]
  ];

  for (const [text, destination] of cases) {
    const result = planIaTurn({ text, pending: null });
    assert.equal(result.kind, "pending", text);
    assert.equal(result.pending.tool, "crearSolicitudTransferencia", text);
    assert.equal(result.pending.args.nombre_bovino, "Bolita", text);
    assert.equal(result.pending.args.usuario_destino, destination, text);
    assert.equal(result.pending.awaitingConfirmation, true, text);
  }
});

test("la IA no permite crear duenos manualmente", () => {
  const result = planIaTurn({
    text: "Crea un dueño llamado user1",
    pending: null
  });

  assert.equal(result.kind, "clarify");
  assert.match(result.respuesta, /cuenta.*propietaria/i);
  assert.equal(__test.extractAction("Crea un dueño llamado user1"), null);
});

test("limita el listado conversacional de razas a la tool especializada", () => {
  for (const text of [
    "¿Qué razas tengo?",
    "Dame las razas disponibles",
    "Enlista todas las razas",
    "Muéstrame las razas registradas"
  ]) {
    const result = planIaTurn({ text, pending: null });
    assert.equal(result.kind, "query", text);
    assert.equal(result.query.tool, "listarRazas", text);
    assert.equal(result.query.args.limite, 10, text);
  }
});

test("detecta solicitudes de amistad por username o correo", () => {
  const cases = [
    ["Envíale una solicitud de amistad a hugoboss", "Hugoboss"],
    ["Agrega a Carlos como amigo", "Carlos"],
    ["Manda solicitud al usuario user2@gmail.com", "user2@gmail.com"]
  ];
  for (const [text, target] of cases) {
    const result = planIaTurn({ text, pending: null });
    assert.equal(result.kind, "pending", text);
    assert.equal(result.pending.tool, "enviarSolicitudAmistad", text);
    assert.equal(result.pending.args.usuario_destino, target, text);
  }
});

test("resuelve venta por nombre inicial o bovino reciente", () => {
  const named = planIaTurn({ text: "¿Marisol está lista para la venta?", pending: null });
  assert.equal(named.kind, "query");
  assert.equal(named.query.args.nombre, "Marisol");

  const contextual = planIaTurn({
    text: "¿Puedo vender a este bovino?",
    pending: null,
    context: { ultimo_bovino_nombre: "Marisol" }
  });
  assert.equal(contextual.query.args.nombre, "Marisol");
});

test("extrae destinatario y contenido de un mensaje comunitario", () => {
  const result = planIaTurn({
    text: "Enviale un mensaje a Carlos: Recibiste el bovino?",
    pending: null
  });
  assert.equal(result.kind, "pending");
  assert.equal(result.pending.tool, "enviarMensaje");
  assert.equal(result.pending.args.usuario_destino, "Carlos");
  assert.equal(result.pending.args.mensaje, "Recibiste el bovino");
});
