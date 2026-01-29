import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_REVIEW_DENSITY_KEY,
  loadReviewDensity,
  normalizeReviewDensity,
  saveReviewDensity,
} from "@/lib/admin/admin-review-density";

void test("normalizeReviewDensity clamps to known values", () => {
  assert.equal(normalizeReviewDensity("compact"), "compact");
  assert.equal(normalizeReviewDensity("comfortable"), "comfortable");
  assert.equal(normalizeReviewDensity("unknown"), "comfortable");
  assert.equal(normalizeReviewDensity(null), "comfortable");
});

void test("loadReviewDensity returns stored value", () => {
  const storage = {
    getItem: (key: string) => (key === ADMIN_REVIEW_DENSITY_KEY ? "compact" : null),
  };
  assert.equal(loadReviewDensity(storage), "compact");
});

void test("saveReviewDensity writes key", () => {
  const saved: Record<string, string> = {};
  const storage = {
    setItem: (key: string, value: string) => {
      saved[key] = value;
    },
  };
  saveReviewDensity(storage, "compact");
  assert.equal(saved[ADMIN_REVIEW_DENSITY_KEY], "compact");
});
