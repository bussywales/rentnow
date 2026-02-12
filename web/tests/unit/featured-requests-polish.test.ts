import test from "node:test";
import assert from "node:assert/strict";
import {
  isFeaturedRequestStale,
  resolveFeaturedRequestHostSummary,
} from "@/lib/featured/requests";
import {
  selectLatestFeaturedRequestsByProperty,
  type OwnerFeaturedRequestState,
} from "@/lib/featured/requests.server";

const NOW = new Date("2026-02-12T12:00:00.000Z");

function makeRow(input: Partial<OwnerFeaturedRequestState> & { property_id: string }): OwnerFeaturedRequestState {
  return {
    id: input.id ?? `${input.property_id}-${input.status ?? "pending"}`,
    property_id: input.property_id,
    duration_days: input.duration_days ?? 7,
    requested_until: input.requested_until ?? null,
    note: input.note ?? null,
    status: input.status ?? "pending",
    admin_note: input.admin_note ?? null,
    decided_at: input.decided_at ?? null,
    created_at: input.created_at ?? NOW.toISOString(),
  };
}

void test("selectLatestFeaturedRequestsByProperty prefers pending over decided rows", () => {
  const rows: OwnerFeaturedRequestState[] = [
    makeRow({
      property_id: "prop-1",
      status: "rejected",
      created_at: "2026-02-11T10:00:00.000Z",
      decided_at: "2026-02-11T10:10:00.000Z",
    }),
    makeRow({
      property_id: "prop-1",
      status: "pending",
      created_at: "2026-02-10T10:00:00.000Z",
    }),
    makeRow({
      property_id: "prop-2",
      status: "approved",
      created_at: "2026-02-10T08:00:00.000Z",
      decided_at: "2026-02-10T08:30:00.000Z",
    }),
    makeRow({
      property_id: "prop-2",
      status: "rejected",
      created_at: "2026-02-11T08:00:00.000Z",
      decided_at: "2026-02-11T09:30:00.000Z",
    }),
  ];

  const mapped = selectLatestFeaturedRequestsByProperty(rows);
  assert.equal(mapped["prop-1"]?.status, "pending");
  assert.equal(mapped["prop-2"]?.status, "rejected");
});

void test("resolveFeaturedRequestHostSummary applies status precedence", () => {
  const featured = resolveFeaturedRequestHostSummary({
    isFeaturedActive: true,
    hasFeaturedUntil: true,
    requestStatus: "rejected",
  });
  assert.equal(featured.state, "featured_active");

  const rejected = resolveFeaturedRequestHostSummary({
    isFeaturedActive: false,
    hasFeaturedUntil: false,
    requestStatus: "rejected",
  });
  assert.equal(rejected.state, "rejected");
  assert.equal(rejected.showDecisionNote, true);
});

void test("isFeaturedRequestStale flags pending requests older than 14 days", () => {
  assert.equal(isFeaturedRequestStale("2026-01-28T11:59:59.000Z", NOW), true);
  assert.equal(isFeaturedRequestStale("2026-02-01T12:00:01.000Z", NOW), false);
  assert.equal(isFeaturedRequestStale("invalid", NOW), false);
});
