import test from "node:test";
import assert from "node:assert/strict";

import { mapPropertyPersistenceError } from "@/lib/properties/persistence-errors";

void test("mapPropertyPersistenceError maps listing_type constraint failures to a field error", () => {
  const payload = mapPropertyPersistenceError(
    'new row for relation "properties" violates check constraint "properties_listing_type_check"'
  );

  assert.equal(payload.code, "INVALID_LISTING_TYPE");
  assert.equal(payload.error, "Choose a valid listing type.");
  assert.deepEqual(payload.fieldErrors, {
    listing_type: "Choose a valid listing type.",
  });
});

void test("mapPropertyPersistenceError preserves unknown messages", () => {
  const payload = mapPropertyPersistenceError("unexpected insert failure");

  assert.equal(payload.code, undefined);
  assert.equal(payload.error, "unexpected insert failure");
  assert.equal(payload.fieldErrors, undefined);
});
