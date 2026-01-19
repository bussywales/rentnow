import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeLabel } from "@/lib/geocode/mapbox";

void test("sanitizeLabel strips leading street numbers", () => {
  assert.equal(sanitizeLabel("123 Main Street, Lagos, Nigeria"), "Main Street, Lagos, Nigeria");
});

void test("sanitizeLabel keeps place names when no number", () => {
  assert.equal(sanitizeLabel("Lekki Phase 1, Lagos"), "Lekki Phase 1, Lagos");
});

void test("sanitizeLabel handles empty result gracefully", () => {
  assert.equal(sanitizeLabel(""), "");
});
