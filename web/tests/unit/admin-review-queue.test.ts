import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_REVIEW_STATUSES,
  CHANGES_STATUS_LIST,
  PENDING_STATUS_LIST,
  APPROVED_STATUS_LIST,
  getStatusesForView,
  isStatusInView,
  normalizeStatus,
  buildStatusOrFilter,
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

void test("normalizeStatus lowercases and trims", () => {
  assert.equal(normalizeStatus(" Pending "), "pending");
  assert.equal(normalizeStatus(null), null);
});

void test("pending allows prefix matches", () => {
  assert.equal(isStatusInView("pending_review_extra", "pending"), true);
  assert.equal(isStatusInView("Pending", "pending"), true);
});

void test("status lists stay in sync for all views", () => {
  assert.deepEqual(new Set(getStatusesForView("changes")), new Set(CHANGES_STATUS_LIST));
  assert.deepEqual(new Set(getStatusesForView("approved")), new Set(APPROVED_STATUS_LIST));
  assert.deepEqual(new Set(getStatusesForView("all")), new Set(ALL_REVIEW_STATUSES));
});

void test("buildStatusOrFilter builds supabase or clause", () => {
  const pendingClause = buildStatusOrFilter("pending");
  assert.ok(pendingClause.includes("status.eq.pending"));
  assert.ok(pendingClause.includes("status.ilike.pending%"));
  const allClause = buildStatusOrFilter("all");
  assert.ok(allClause.includes("status.eq.live"));
  assert.ok(allClause.includes("status.eq.changes_requested"));
});
