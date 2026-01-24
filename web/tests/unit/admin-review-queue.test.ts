import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_REVIEW_STATUSES,
  CHANGES_STATUS_LIST,
  PENDING_STATUS_LIST,
  APPROVED_STATUS_LIST,
  getStatusesForView,
  isStatusInView,
} from "@/lib/admin/admin-review-queue";

void test("pending statuses include pending", () => {
  assert.ok(PENDING_STATUS_LIST.includes("pending"));
  assert.deepEqual(new Set(PENDING_STATUS_LIST), new Set(getStatusesForView("pending")));
});

void test("pending badge filter matches review filter", () => {
  const pending = new Set(PENDING_STATUS_LIST);
  const reviewPending = new Set(getStatusesForView("pending"));
  assert.deepEqual(pending, reviewPending);
});

void test("isStatusInView aligns with statuses list", () => {
  const pendingStatuses = getStatusesForView("pending");
  pendingStatuses.forEach((s) => assert.equal(isStatusInView(s, "pending"), true));
  assert.equal(isStatusInView("live", "pending"), false);
});

void test("status lists stay in sync for all views", () => {
  assert.deepEqual(new Set(getStatusesForView("changes")), new Set(CHANGES_STATUS_LIST));
  assert.deepEqual(new Set(getStatusesForView("approved")), new Set(APPROVED_STATUS_LIST));
  assert.deepEqual(new Set(getStatusesForView("all")), new Set(ALL_REVIEW_STATUSES));
});
