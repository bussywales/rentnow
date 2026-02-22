import test from "node:test";
import assert from "node:assert/strict";
import {
  countAwaitingApprovalBookings,
  formatRespondByCountdownLabel,
  isAwaitingApprovalBooking,
  parseHostBookingQueryParam,
  parseHostBookingInboxFilterParam,
  resolveHostBookingInboxFilter,
  rowMatchesHostBookingInboxFilter,
  sortHostBookingInboxRows,
  shouldDefaultHostToBookingsInbox,
  type HostBookingInboxRow,
} from "@/lib/shortlet/host-bookings-inbox";

function bookingRow(overrides: Partial<HostBookingInboxRow>): HostBookingInboxRow {
  return {
    id: "6fd8d9f3-f3df-4d6f-bd5f-e4b4f640e6ea",
    status: "pending",
    check_in: "2026-03-12",
    check_out: "2026-03-14",
    respond_by: null,
    expires_at: null,
    created_at: "2026-03-09T09:00:00.000Z",
    updated_at: "2026-03-09T09:00:00.000Z",
    ...overrides,
  };
}

void test("resolveHostBookingInboxFilter maps bookings into inbox buckets", () => {
  const now = new Date("2026-03-10T09:00:00.000Z");

  assert.equal(resolveHostBookingInboxFilter(bookingRow({ status: "pending" }), now), "awaiting_approval");
  assert.equal(
    resolveHostBookingInboxFilter(bookingRow({ status: "confirmed", check_out: "2026-03-18" }), now),
    "upcoming"
  );
  assert.equal(
    resolveHostBookingInboxFilter(bookingRow({ status: "confirmed", check_out: "2026-03-08" }), now),
    "past"
  );
  assert.equal(resolveHostBookingInboxFilter(bookingRow({ status: "completed" }), now), "past");
  assert.equal(resolveHostBookingInboxFilter(bookingRow({ status: "declined" }), now), "closed");
  assert.equal(resolveHostBookingInboxFilter(bookingRow({ status: "cancelled" }), now), "closed");
  assert.equal(resolveHostBookingInboxFilter(bookingRow({ status: "expired" }), now), "closed");
  assert.equal(
    resolveHostBookingInboxFilter(
      bookingRow({
        status: "pending",
        respond_by: "2026-03-10T08:59:00.000Z",
      }),
      now
    ),
    "closed"
  );
});

void test("rowMatchesHostBookingInboxFilter respects selected filter", () => {
  const row = bookingRow({ status: "confirmed", check_out: "2026-03-18" });
  assert.equal(rowMatchesHostBookingInboxFilter(row, "upcoming", new Date("2026-03-10T00:00:00Z")), true);
  assert.equal(rowMatchesHostBookingInboxFilter(row, "past", new Date("2026-03-10T00:00:00Z")), false);
});

void test("parseHostBookingQueryParam accepts UUID and rejects invalid ids", () => {
  assert.equal(
    parseHostBookingQueryParam("6FD8D9F3-F3DF-4D6F-BD5F-E4B4F640E6EA"),
    "6fd8d9f3-f3df-4d6f-bd5f-e4b4f640e6ea"
  );
  assert.equal(parseHostBookingQueryParam("not-a-booking-id"), null);
  assert.equal(parseHostBookingQueryParam(""), null);
});

void test("respond-by countdown copy always references 12-hour window", () => {
  const nowMs = Date.parse("2026-03-10T10:00:00.000Z");
  assert.match(
    formatRespondByCountdownLabel("2026-03-10T10:20:00.000Z", nowMs),
    /12-hour response window/
  );
  assert.match(
    formatRespondByCountdownLabel("2026-03-10T09:59:00.000Z", nowMs),
    /12-hour response window/
  );
  assert.match(formatRespondByCountdownLabel(null, nowMs), /12 hours/);
});

void test("awaiting approval helpers enforce response window", () => {
  const now = new Date("2026-03-10T09:00:00.000Z");
  assert.equal(
    isAwaitingApprovalBooking(
      bookingRow({ status: "pending", respond_by: "2026-03-10T10:00:00.000Z" }),
      now
    ),
    true
  );
  assert.equal(
    isAwaitingApprovalBooking(
      bookingRow({ status: "pending", respond_by: "2026-03-10T08:00:00.000Z" }),
      now
    ),
    false
  );
  assert.equal(
    isAwaitingApprovalBooking(
      bookingRow({ status: "pending_payment", respond_by: "2026-03-10T10:00:00.000Z" }),
      now
    ),
    false
  );
  assert.equal(
    countAwaitingApprovalBookings(
      [
        bookingRow({ status: "pending", respond_by: "2026-03-10T10:00:00.000Z" }),
        bookingRow({ status: "pending_payment", respond_by: "2026-03-10T10:30:00.000Z" }),
        bookingRow({ status: "pending", respond_by: "2026-03-10T08:00:00.000Z" }),
        bookingRow({ status: "confirmed" }),
      ],
      now
    ),
    1
  );
});

void test("default host bookings behaviour triggers only for urgent pending approvals", () => {
  assert.equal(
    shouldDefaultHostToBookingsInbox({
      awaitingApprovalCount: 2,
      tab: null,
      section: null,
      bookingId: null,
    }),
    true
  );
  assert.equal(
    shouldDefaultHostToBookingsInbox({
      awaitingApprovalCount: 2,
      tab: "bookings",
      section: null,
      bookingId: null,
    }),
    false
  );
  assert.equal(
    shouldDefaultHostToBookingsInbox({
      awaitingApprovalCount: 0,
      tab: null,
      section: null,
      bookingId: null,
    }),
    false
  );
  assert.equal(
    shouldDefaultHostToBookingsInbox({
      awaitingApprovalCount: 2,
      tab: "listings",
      section: null,
      bookingId: null,
    }),
    false
  );
  assert.equal(
    shouldDefaultHostToBookingsInbox({
      awaitingApprovalCount: 2,
      tab: null,
      section: null,
      bookingId: "6fd8d9f3-f3df-4d6f-bd5f-e4b4f640e6ea",
    }),
    true
  );
});

void test("host booking view param parser supports awaiting alias", () => {
  assert.equal(parseHostBookingInboxFilterParam("awaiting"), "awaiting_approval");
  assert.equal(parseHostBookingInboxFilterParam("upcoming"), "upcoming");
  assert.equal(parseHostBookingInboxFilterParam("all"), null);
});

void test("pending_payment is excluded from host actionable awaiting-approval bucket", () => {
  const now = new Date("2026-03-10T09:00:00.000Z");

  assert.equal(
    resolveHostBookingInboxFilter(
      bookingRow({
        status: "pending_payment",
        respond_by: "2026-03-10T12:00:00.000Z",
      }),
      now
    ),
    "closed"
  );

  assert.equal(
    resolveHostBookingInboxFilter(
      bookingRow({
        status: "pending",
        respond_by: "2026-03-10T12:00:00.000Z",
      }),
      now
    ),
    "awaiting_approval"
  );
});

void test("host inbox awaiting approval sort prioritizes earliest respond-by then created_at", () => {
  const sorted = sortHostBookingInboxRows(
    [
      bookingRow({
        id: "0cd3477c-7847-4fcb-a7c9-bca2ce5f9ef4",
        respond_by: "2026-03-10T14:00:00.000Z",
        created_at: "2026-03-10T09:00:00.000Z",
      }),
      bookingRow({
        id: "ae985f80-f4fb-44c0-995d-e29f3cc2efe4",
        respond_by: "2026-03-10T12:00:00.000Z",
        created_at: "2026-03-10T11:00:00.000Z",
      }),
      bookingRow({
        id: "1455af0d-0f56-4343-af94-f01d4f3f4432",
        respond_by: "2026-03-10T12:00:00.000Z",
        created_at: "2026-03-10T08:00:00.000Z",
      }),
    ],
    "awaiting_approval"
  );

  assert.deepEqual(
    sorted.map((row) => row.id),
    [
      "1455af0d-0f56-4343-af94-f01d4f3f4432",
      "ae985f80-f4fb-44c0-995d-e29f3cc2efe4",
      "0cd3477c-7847-4fcb-a7c9-bca2ce5f9ef4",
    ]
  );
});

void test("host inbox upcoming and closed/past sort with policy order", () => {
  const upcoming = sortHostBookingInboxRows(
    [
      bookingRow({
        id: "6286a15e-8704-4fbb-8b49-b88045f8e2ff",
        status: "confirmed",
        check_in: "2026-03-15",
      }),
      bookingRow({
        id: "d4bf8d97-ad4a-4b78-b79f-aee7d2b4d8f0",
        status: "confirmed",
        check_in: "2026-03-12",
      }),
    ],
    "upcoming"
  );
  assert.deepEqual(upcoming.map((row) => row.id), [
    "d4bf8d97-ad4a-4b78-b79f-aee7d2b4d8f0",
    "6286a15e-8704-4fbb-8b49-b88045f8e2ff",
  ]);

  const closed = sortHostBookingInboxRows(
    [
      bookingRow({
        id: "5f9affea-4ca6-44ff-b169-04ace42d5f42",
        status: "declined",
        updated_at: "2026-03-11T10:00:00.000Z",
      }),
      bookingRow({
        id: "67f0744d-7969-46d9-8d37-6ab2fbb05517",
        status: "declined",
        updated_at: "2026-03-12T10:00:00.000Z",
      }),
    ],
    "closed"
  );
  assert.deepEqual(closed.map((row) => row.id), [
    "67f0744d-7969-46d9-8d37-6ab2fbb05517",
    "5f9affea-4ca6-44ff-b169-04ace42d5f42",
  ]);
});
