import test from "node:test";
import assert from "node:assert/strict";

import {
  memoryConfirmation,
  memoryToUserPerspective
} from "../lib/iaMemoryPerspective.js";

test("convierte identidad en primera persona a segunda persona", () => {
  assert.equal(
    memoryToUserPerspective("soy el mas chingon"),
    "eres el mas chingon"
  );
  assert.equal(
    memoryConfirmation("soy el mas chingon"),
    "Entendido, recordare que eres el mas chingon."
  );
});

test("convierte preferencias y datos personales hacia el usuario", () => {
  assert.equal(memoryToUserPerspective("me llamo Hugo"), "te llamas Hugo");
  assert.equal(memoryToUserPerspective("me gusta el ganado"), "te gusta el ganado");
  assert.equal(memoryToUserPerspective("mi rancho favorito es El Sol"), "tu rancho favorito es El Sol");
  assert.equal(memoryToUserPerspective("vivo en Tamaulipas"), "vives en Tamaulipas");
});
