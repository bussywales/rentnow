import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFocusParam, normalizeStepParam } from "@/lib/properties/step-params";

void test("normalizeStepParam maps photos to photos step", () => {
  assert.equal(normalizeStepParam("photos"), "photos");
});

void test("normalizeStepParam defaults unknown to basics", () => {
  assert.equal(normalizeStepParam("unknown"), "basics");
});

void test("normalizeFocusParam maps location", () => {
  assert.equal(normalizeFocusParam("location"), "location");
});

void test("normalizeFocusParam ignores unknown focus", () => {
  assert.equal(normalizeFocusParam("other"), null);
});
