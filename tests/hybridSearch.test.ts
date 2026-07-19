import test from "node:test";
import assert from "node:assert/strict";
import { reciprocalRankFusion } from "../lib/rrf";

test("RRF favorece resultados presentes en busqueda vectorial y textual", () => {
  const results = reciprocalRankFusion(
    [
      { id: 1, source: "semantic_contexts", content: "uno", score: 0.9 },
      { id: 2, source: "semantic_contexts", content: "dos", score: 0.8 }
    ],
    [
      { id: 2, source: "semantic_contexts", content: "dos", score: 0.7 },
      { id: 3, source: "memories", content: "tres", score: 0.6 }
    ],
    3,
    60
  );

  assert.equal(results[0]?.id, 2);
  assert.ok((results[0]?.fusedScore ?? 0) > (results[1]?.fusedScore ?? 0));
});

test("RRF mantiene separadas fuentes con el mismo id", () => {
  const results = reciprocalRankFusion(
    [{ id: 1, source: "semantic_contexts", content: "contexto", score: 1 }],
    [{ id: 1, source: "memories", content: "memoria", score: 1 }]
  );
  assert.equal(results.length, 2);
});

