import test from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
import {
  optionalIntNonnegative,
  optionalNonnegativeNumber,
  optionalPositiveNumber,
} from "@/lib/properties/validation";
import { propertySchema } from "@/app/api/properties/route";

void test("optional numeric helpers accept empty values and reject invalid", () => {
  const positive = optionalPositiveNumber();
  const nonnegative = optionalNonnegativeNumber();
  const intNonnegative = optionalIntNonnegative();

  // Empty-ish inputs are treated as undefined
  assert.equal(positive.parse(undefined), undefined);
  assert.equal(positive.parse(null), undefined);
  assert.equal(positive.parse(""), undefined);
  assert.equal(nonnegative.parse(undefined), undefined);
  assert.equal(nonnegative.parse(null), undefined);
  assert.equal(nonnegative.parse(""), undefined);
  assert.equal(intNonnegative.parse(undefined), undefined);
  assert.equal(intNonnegative.parse(null), undefined);
  assert.equal(intNonnegative.parse(""), undefined);

  // Invalid non-empty values throw
  assert.throws(() => positive.parse("abc"), ZodError);
  assert.throws(() => nonnegative.parse(-1), ZodError);
  assert.throws(() => intNonnegative.parse(-5), ZodError);
});

void test("draft property payload treats optional numerics as undefined, not NaN", () => {
  const payload = {
    title: "Test listing",
    city: "LA",
    rental_type: "long_term" as const,
    price: 1000,
    currency: "USD",
    bedrooms: 2,
    bathrooms: 1,
    furnished: false,
    size_value: null,
    deposit_amount: "",
    status: "draft" as const,
  };

  const parsed = propertySchema.parse(payload);
  assert.equal(parsed.size_value, undefined, "size_value should be undefined when empty");
  assert.equal(
    parsed.deposit_amount,
    undefined,
    "deposit_amount should be undefined when empty"
  );
});
