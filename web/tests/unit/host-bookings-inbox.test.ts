import test from "node:test";
import assert from "node:assert/strict";
import {
  formatRespondByCountdownLabel,
  parseHostBookingQueryParam,
  resolveHostBookingInboxFilter,
  rowMatchesHostBookingInboxFilter,
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
