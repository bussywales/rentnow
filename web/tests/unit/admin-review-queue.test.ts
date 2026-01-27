import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_REVIEW_STATUSES,
  CHANGES_STATUS_LIST,
  PENDING_STATUS_LIST,
  APPROVED_STATUS_LIST,
  sanitizeStatusSet,
  getStatusesForView,
  isStatusInView,
  normalizeStatus,
  buildStatusOrFilter,
  isReviewableRow,
  buildReviewableOrClause,
  getAdminReviewQueue,
  fetchReviewableUnion,
} from "@/lib/admin/admin-review-queue";
import { ADMIN_REVIEW_QUEUE_SELECT } from "@/lib/admin/admin-review-contracts";

void test("pending statuses include pending", () => {
  assert.ok(PENDING_STATUS_LIST.includes("pending"));
  assert.deepEqual(new Set(PENDING_STATUS_LIST), new Set(getStatusesForView("pending")));
});

void test("pending status set is enum-safe", () => {
  assert.deepEqual(PENDING_STATUS_LIST, ["pending"]);
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

void test("pending view requires enum-safe status", () => {
  assert.equal(isStatusInView("Pending", "pending"), true);
  assert.equal(isStatusInView("pending_review_extra", "pending"), false);
});

void test("status lists stay in sync for all views", () => {
  assert.deepEqual(new Set(getStatusesForView("changes")), new Set(CHANGES_STATUS_LIST));
  assert.deepEqual(new Set(getStatusesForView("approved")), new Set(APPROVED_STATUS_LIST));
  assert.deepEqual(new Set(getStatusesForView("all")), new Set(ALL_REVIEW_STATUSES));
});

void test("buildStatusOrFilter builds supabase or clause", () => {
  const pendingClause = buildStatusOrFilter("pending");
  assert.ok(pendingClause.includes("status.eq.pending"));
  assert.equal(pendingClause.includes("%"), false);
  const allClause = buildStatusOrFilter("all");
  assert.ok(allClause.includes("status.eq.live"));
  assert.ok(allClause.includes("status.eq.pending"));
});

void test("buildReviewableOrClause includes submitted_at fallback", () => {
  const clause = buildReviewableOrClause();
  assert.ok(clause.includes("submitted_at.not.is.null"));
  assert.ok(clause.includes("status.eq.pending"));
  assert.equal(clause.includes("%"), false);
  const expectedStatuses = ["pending"];
  expectedStatuses.forEach((s) => assert.ok(clause.includes(`status.eq.${s}`)));
});

void test("reviewable row predicate allows submitted_at + active", () => {
  const row = {
    status: "pending",
    submitted_at: "2024-01-01T00:00:00Z",
    is_approved: false,
    approved_at: null,
    rejected_at: null,
    is_active: true,
  };
  assert.equal(isReviewableRow(row), true);
});

class MockBuilder {
  clauses: string[] = [];
  orClause: string | null = null;
  data: unknown[];
  count: number;
  error: unknown = null;
  status: number | null = null;
  constructor(data: unknown[]) {
    this.data = data;
    this.count = data.length;
  }
  eq(field: string, val: unknown) {
    this.clauses.push(`eq:${field}:${val}`);
    return this;
  }
  is(field: string, val: unknown) {
    this.clauses.push(`is:${field}:${val}`);
    return this;
  }
  in(field: string, vals: unknown[]) {
    this.clauses.push(`in:${field}:${vals.join("|")}`);
    return this;
  }
  not(field: string, op: string, val: unknown) {
    this.clauses.push(`not:${field}:${op}:${val}`);
    return this;
  }
  or(val: string) {
    this.orClause = val;
    this.clauses.push(`or:${val}`);
    return this;
  }
  limit() {
    return this;
  }
  order() {
    return this;
  }
  then(onFulfilled: (value: unknown) => unknown) {
    const res = onFulfilled({ data: this.data, count: this.count, error: this.error, status: this.status });
    return Promise.resolve(res);
  }
}

class MockClient {
  lastBuilder: MockBuilder | null = null;
  data: unknown[];
  constructor(data: unknown[]) {
    this.data = data;
  }
  from() {
    return {
      select: () => {
        this.lastBuilder = new MockBuilder(this.data);
        return this.lastBuilder;
      },
    };
  }
}

void test("getAdminReviewQueue returns reviewable pending row with correct or clause", async () => {
  const row = {
    id: "1",
    status: "pending",
    submitted_at: "2024-01-01T00:00:00Z",
    is_approved: false,
    approved_at: null,
    rejected_at: null,
  };
  const client = new MockClient([row]);
  const result = await getAdminReviewQueue({
    userClient: client as unknown as { from: () => { select: () => MockBuilder } },
    serviceClient: null,
    viewerRole: "admin",
    select: ADMIN_REVIEW_QUEUE_SELECT,
    pendingSet: ["pending", "pending_review"],
  });
  assert.equal(result.count, 1);
  assert.equal(result.meta.source, "user");
  assert.equal(result.meta.serviceAttempted, false);
  assert.equal(result.data?.length, 1);
  assert.equal(result.rows?.length, 1);
  assert.deepEqual(result.data, result.rows);
  assert.equal(result.rows?.length, result.count);
});

void test("sanitizeStatusSet drops invalid statuses", () => {
  const input = ["pending", "PENDING_REVIEW", " live ", "foo", "pending"];
  const result = sanitizeStatusSet(input);
  assert.deepEqual(result, ["pending", "live"]);
});

void test("fetchReviewableUnion uses sanitized pending set", async () => {
  const row = { id: "1", status: "pending" };
  const client = new MockClient([row]);
  const result = await fetchReviewableUnion(client as unknown as { from: () => { select: () => MockBuilder } }, "id", [
    "pending",
    "pending_review",
    "foo",
  ]);
  assert.deepEqual(result.debug.pendingSetSanitized, ["pending"]);
  assert.ok(result.debug.droppedStatuses.includes("pending_review"));
});

void test("getAdminReviewQueue exposes merged rows on data and rows", async () => {
  const rows = [
    { id: "1", status: "pending", submitted_at: "2024-01-01T00:00:00Z" },
    { id: "1", status: "pending", submitted_at: "2024-01-02T00:00:00Z" },
    { id: "2", status: "pending", submitted_at: "2024-01-03T00:00:00Z" },
  ];
  const client = new MockClient(rows);
  const result = await getAdminReviewQueue({
    userClient: client as unknown as { from: () => { select: () => MockBuilder } },
    serviceClient: null,
    viewerRole: "admin",
    select: ADMIN_REVIEW_QUEUE_SELECT,
  });
  assert.equal(result.count, 2);
  assert.equal(result.data?.length, result.count);
  assert.equal(result.rows?.length, result.count);
  assert.deepEqual(result.rows, result.data);
  assert.ok((result.data?.length ?? 0) > 0);
});

void test("getAdminReviewQueue falls back to user on service error", async () => {
  class ErrorBuilder extends MockBuilder {
    constructor(data: unknown[]) {
      super(data);
      this.error = { message: "fail" };
      this.status = 500;
    }
  }
  class ErrorClient extends MockClient {
    from() {
      return {
        select: () => new ErrorBuilder([]),
      };
    }
  }
  const userClient = new MockClient([{ id: "1", status: "pending" }]);
  const serviceClient = new ErrorClient([]);
  const result = await getAdminReviewQueue({
    userClient: userClient as unknown as { from: () => { select: () => MockBuilder } },
    serviceClient: serviceClient as unknown as { from: () => { select: () => ErrorBuilder } },
    viewerRole: "admin",
    select: ADMIN_REVIEW_QUEUE_SELECT,
  });
  assert.equal(result.count, 1);
  assert.equal(result.data?.length, result.count);
  assert.deepEqual(result.data, result.rows);
  assert.equal(result.meta.source, "user");
  assert.equal(result.meta.serviceAttempted, true);
  assert.equal(result.meta.serviceOk, false);
});
