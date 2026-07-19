import test from "node:test";
import assert from "node:assert/strict";
import { buildPostgresTextQuery } from "../lib/fullTextSearch";

test("construye una consulta OR con terminos ganaderos significativos", () => {
  assert.equal(
    buildPostgresTextQuery("Explica como prevenir la brucelosis bovina"),
    "prevenir | brucelosis | bovina"
  );
});

test("normaliza acentos y limita palabras vacias", () => {
  assert.equal(
    buildPostgresTextQuery("¿Para qué sirven las vacunas clostridiales?"),
    "vacunas | clostridiales"
  );
});

