import test from "node:test";
import assert from "node:assert/strict";
import { summarizeHostListingsPortfolio } from "@/lib/host/listings-manager";
import type { DashboardListing } from "@/lib/properties/host-dashboard";

function listing(overrides: Partial<DashboardListing>): DashboardListing {
  return {
    id: "listing-id",
    title: "Listing",
    status: "draft",
    created_at: "2026-02-10T10:00:00.000Z",
    updated_at: "2026-02-10T10:00:00.000Z",
    location_label: null,
    city: null,
    admin_area_1: null,
    admin_area_2: null,
    postal_code: null,
    expires_at: null,
    readiness: {
      score: 50,
      tier: "Needs work",
      issues: [],
      suggestions: [],
    },
    ...overrides,
  } as DashboardListing;
}

void test("portfolio stats strip summary counts live/pending/draft/paused from loaded listings", () => {
  const rows: DashboardListing[] = [
    listing({ id: "live-1", status: "live" }),
    listing({ id: "live-2", status: "live" }),
    listing({ id: "pending-1", status: "pending" }),
    listing({ id: "draft-1", status: "draft" }),
    listing({ id: "paused-1", status: "paused_owner" }),
  ];

  assert.deepEqual(summarizeHostListingsPortfolio(rows), {
    total: 5,
    live: 2,
    pending: 1,
    draft: 1,
    paused: 1,
  });
});
