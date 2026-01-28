import test from "node:test";
import assert from "node:assert/strict";

void test("admin page module imports without throwing", async () => {
  await assert.doesNotReject(async () => import("@/app/admin/page"));
});
