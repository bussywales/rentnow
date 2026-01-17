import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import {
  mapZodErrorToFieldErrors,
  optionalYearBuilt,
} from "../../lib/properties/validation";

void test("year_built accepts empty input as optional", () => {
  const schema = z.object({
    year_built: optionalYearBuilt(),
  });

  const result = schema.safeParse({ year_built: "" });
  assert.equal(result.success, true, "expected empty year_built to be allowed");
  if (result.success) {
    assert.equal(result.data.year_built, undefined);
  }
});

void test("year_built enforces lower bound", () => {
  const schema = z.object({
    year_built: optionalYearBuilt(),
  });
  const result = schema.safeParse({ year_built: "1799" });
  assert.equal(result.success, false);
  if (!result.success) {
    const fieldErrors = mapZodErrorToFieldErrors(result.error);
    assert.ok(fieldErrors.year_built);
  }
});

void test("year_built coerces valid strings", () => {
  const schema = z.object({
    year_built: optionalYearBuilt(),
  });
  const result = schema.safeParse({ year_built: "1998" });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.year_built, 1998);
  }
});
