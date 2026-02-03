import test from "node:test";
import assert from "node:assert/strict";
import { mapStatusLabel } from "@/lib/properties/status";

void test("status labels are friendly", () => {
  assert.equal(mapStatusLabel("pending"), "Under review");
  assert.equal(mapStatusLabel("paused_owner"), "Paused (Owner hold)");
  assert.equal(mapStatusLabel("paused_occupied"), "Paused (Occupied)");
  assert.equal(mapStatusLabel("changes_requested"), "Changes requested");

  assert.notEqual(mapStatusLabel("paused_owner"), "paused_owner");
  assert.notEqual(mapStatusLabel("pending"), "pending");
});
