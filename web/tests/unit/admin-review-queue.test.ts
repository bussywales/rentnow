import test from "node:test";
import assert from "node:assert/strict";
import { getStatusesForView, isStatusInView } from "@/lib/admin/admin-review-queue";

void test("pending statuses include pending", () => {
  const pending = getStatusesForView("pending");
  assert.ok(pending.includes("pending"));
});

void test("pending badge filter matches review filter", () => {
  const pending = new Set(getStatusesForView("pending"));
  const reviewPending = new Set(getStatusesForView("pending"));
  assert.equal(pending.size, reviewPending.size);
  pending.forEach((s) => reviewPending.has(s));
});

void test("isStatusInView aligns with statuses list", () => {
  const pendingStatuses = getStatusesForView("pending");
  pendingStatuses.forEach((s) => assert.equal(isStatusInView(s, "pending"), true));
  assert.equal(isStatusInView("live", "pending"), false);
});
