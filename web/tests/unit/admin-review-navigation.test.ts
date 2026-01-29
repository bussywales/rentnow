import test from "node:test";
import assert from "node:assert/strict";
import { pickNextId } from "@/lib/admin/admin-review";

test("pickNextId chooses next then previous then null", () => {
  const ids = ["a", "b", "c"];
  assert.equal(pickNextId(ids, "b"), "c");
  assert.equal(pickNextId(ids, "c"), "b");
  assert.equal(pickNextId(ids, "missing"), "a");
  assert.equal(pickNextId([], "a"), null);
});
