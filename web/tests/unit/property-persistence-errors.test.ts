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

void test("mapPropertyPersistenceError sanitizes schema mismatch errors", () => {
  const payload = mapPropertyPersistenceError(
    'Could not find the "commercial_layout_type" column of "properties" in the schema cache'
  );

  assert.equal(payload.code, undefined);
  assert.equal(payload.error, "We couldn’t save this listing right now. Try again in a moment.");
  assert.equal(payload.fieldErrors, undefined);
});

void test("mapPropertyPersistenceError preserves safe non-technical copy", () => {
  const payload = mapPropertyPersistenceError("Listing title is too short.");

  assert.equal(payload.code, undefined);
  assert.equal(payload.error, "Listing title is too short.");
  assert.equal(payload.fieldErrors, undefined);
});
