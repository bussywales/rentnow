import test from "node:test";
import assert from "node:assert/strict";
import { classifyCoverHint } from "@/lib/properties/cover-hint";

void test("classifyCoverHint flags portrait and too small", () => {
  const result = classifyCoverHint({ width: 800, height: 1200 });
  assert.equal(result.portrait, true);
  assert.equal(result.tooSmall, true);
  assert.equal(result.unknown, false);
});

void test("classifyCoverHint ok dimensions", () => {
  const result = classifyCoverHint({ width: 2000, height: 1200 });
  assert.equal(result.portrait, false);
  assert.equal(result.tooSmall, false);
  assert.equal(result.unknown, false);
});

void test("classifyCoverHint unknown when missing dims", () => {
  const result = classifyCoverHint({});
  assert.equal(result.unknown, true);
});
