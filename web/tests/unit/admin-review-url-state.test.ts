import test from "node:test";
import assert from "node:assert/strict";
import { buildSelectedUrl, parseSelectedId } from "@/lib/admin/admin-review";

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
