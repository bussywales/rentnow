import test from "node:test";
import assert from "node:assert/strict";
import { deriveReliability } from "@/lib/viewings/reliability";

void test("reliability unknown when no data", () => {
  const snap = deriveReliability(0, 0);
  assert.equal(snap.label, "Unknown");
});

void test("reliability mixed when any no-shows", () => {
  const snap = deriveReliability(2, 5);
  assert.equal(snap.label, "Mixed");
});

void test("reliability reliable when completed and no no-shows", () => {
  const snap = deriveReliability(0, 3);
  assert.equal(snap.label, "Reliable");
});
