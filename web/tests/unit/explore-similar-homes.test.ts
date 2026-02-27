import test from "node:test";
import assert from "node:assert/strict";
import { mockProperties } from "@/lib/mock";
import { resolveSimilarHomes } from "@/lib/explore/similar-homes";

void test("resolveSimilarHomes excludes current listing and caps at three results", () => {
  const current = mockProperties[0]!;
  const similar = resolveSimilarHomes(current, mockProperties);

  assert.ok(similar.length <= 3);
  assert.ok(similar.every((item) => item.id !== current.id));
});

void test("resolveSimilarHomes stays deterministic for same input", () => {
  const current = mockProperties[1]!;
  const first = resolveSimilarHomes(current, mockProperties).map((item) => item.id);
  const second = resolveSimilarHomes(current, mockProperties).map((item) => item.id);

  assert.deepEqual(first, second);
});
