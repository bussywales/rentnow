import test from "node:test";
import assert from "node:assert/strict";
import { bodySchema } from "@/app/api/admin/properties/[id]/route";

void test("approve payload allows missing reason", () => {
  const parsed = bodySchema.parse({ action: "approve", reason: null });
  assert.equal(parsed.action, "approve");
});

void test("reject payload requires non-empty reason", () => {
  assert.throws(
    () => bodySchema.parse({ action: "reject", reason: "" }),
    /Rejection reason is required/
  );
  const parsed = bodySchema.parse({ action: "reject", reason: "Not enough photos" });
  assert.equal(parsed.action, "reject");
  assert.equal(parsed.reason, "Not enough photos");
});
