import test from "node:test";
import assert from "node:assert/strict";
import {
  addMonthsToIsoDate,
  evaluateVaccineInterval
} from "../lib/vaccinationInterval.js";

test("bloquea una vacuna antes de seis meses", () => {
  const result = evaluateVaccineInterval("2026-01-15", "2026-07-14");
  assert.equal(result.allowed, false);
  if (result.allowed) return;
  assert.equal(result.nextAllowedDate, "2026-07-15");
  assert.match(result.message, /2026-01-15/);
  assert.match(result.message, /2026-07-15/);
});

test("permite una vacuna al cumplir seis meses", () => {
  const result = evaluateVaccineInterval("2026-01-15", "2026-07-15");
  assert.equal(result.allowed, true);
  assert.equal(result.nextAllowedDate, "2027-01-15");
});

test("calcula meses calendario sin desbordar fin de mes", () => {
  assert.equal(addMonthsToIsoDate("2025-08-31"), "2026-02-28");
  assert.equal(addMonthsToIsoDate("2024-08-31"), "2025-02-28");
});
