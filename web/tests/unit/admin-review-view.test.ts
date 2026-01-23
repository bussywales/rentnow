import test from "node:test";
import assert from "node:assert/strict";
import { normalizeView } from "@/lib/admin/admin-review-view";

void test("normalizeView defaults to pending", () => {
  assert.equal(normalizeView(undefined), "pending");
  assert.equal(normalizeView(""), "pending");
});

void test("normalizeView allows only known values", () => {
  assert.equal(normalizeView("pending"), "pending");
  assert.equal(normalizeView("changes"), "changes");
  assert.equal(normalizeView("approved"), "approved");
  assert.equal(normalizeView("all"), "all");
  assert.equal(normalizeView("weird"), "pending");
});
