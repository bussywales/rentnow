import test from "node:test";
import assert from "node:assert/strict";
import { cleanNullableString } from "@/lib/strings";

void test("cleanNullableString trims whitespace and converts empty to null", () => {
  assert.equal(cleanNullableString("  Lagos  "), "Lagos");
  assert.equal(cleanNullableString(""), null);
  assert.equal(cleanNullableString("   "), null);
  assert.equal(cleanNullableString(null), null);
  assert.equal(cleanNullableString(undefined), undefined);
});

void test("cleanNullableString can force undefined to null", () => {
  assert.equal(cleanNullableString(undefined, { allowUndefined: false }), null);
});
