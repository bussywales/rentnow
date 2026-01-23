import test from "node:test";
import assert from "node:assert/strict";
import { buildSelectedUrl, parseSelectedId } from "@/lib/admin/admin-review";
import { normalizeView } from "@/lib/admin/admin-review-view";

void test("parseSelectedId handles URLSearchParams and objects", () => {
  const params = new URLSearchParams({ id: "abc-123" });
  assert.equal(parseSelectedId(params), "abc-123");
  assert.equal(parseSelectedId({ id: "xyz" }), "xyz");
  assert.equal(parseSelectedId({}), null);
});

void test("buildSelectedUrl adds id param when provided", () => {
  const path = "/admin/review";
  assert.equal(buildSelectedUrl(path, "abc"), "/admin/review?id=abc");
  assert.equal(buildSelectedUrl(path, null), "/admin/review");
});

void test("normalizeView clamps to allowed set", () => {
  assert.equal(normalizeView("pending"), "pending");
  assert.equal(normalizeView("changes"), "changes");
  assert.equal(normalizeView("approved"), "approved");
  assert.equal(normalizeView("all"), "all");
  assert.equal(normalizeView("unknown"), "pending");
  assert.equal(normalizeView(null), "pending");
});
