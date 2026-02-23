import test from "node:test";
import assert from "node:assert/strict";
import {
  countByManagerStatus,
  filterAndSortHostProperties,
  type HostPropertiesManagerQuery,
} from "@/lib/host/properties-manager";
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

const baseQuery: HostPropertiesManagerQuery = {
  status: "all",
  search: "",
  sort: "updated",
};

void test("host properties manager status filters return expected rows", () => {
  const rows: DashboardListing[] = [
    listing({ id: "live-1", status: "live", title: "Ikeja apartment" }),
    listing({ id: "pending-1", status: "pending", title: "Lekki duplex" }),
    listing({ id: "paused-1", status: "paused_owner", title: "Abuja villa" }),
    listing({ id: "draft-1", status: "draft", title: "Yaba loft" }),
  ];

  assert.deepEqual(
    filterAndSortHostProperties(rows, { ...baseQuery, status: "pending" }).map((row) => row.id),
    ["pending-1"]
  );

  assert.deepEqual(
    filterAndSortHostProperties(rows, { ...baseQuery, status: "paused" }).map((row) => row.id),
    ["paused-1"]
  );

  assert.deepEqual(
    filterAndSortHostProperties(rows, { ...baseQuery, status: "draft" }).map((row) => row.id),
    ["draft-1"]
  );

  assert.deepEqual(countByManagerStatus(rows), {
    all: 4,
    live: 1,
    pending: 1,
    paused: 1,
    draft: 1,
  });
});

void test("host properties manager search and sort update visible result ordering", () => {
  const rows: DashboardListing[] = [
    listing({
      id: "a",
      status: "live",
      title: "Ikeja apartment",
      created_at: "2026-02-01T10:00:00.000Z",
      updated_at: "2026-02-05T10:00:00.000Z",
    }),
    listing({
      id: "b",
      status: "live",
      title: "Lekki penthouse",
      created_at: "2026-02-03T10:00:00.000Z",
      updated_at: "2026-02-04T10:00:00.000Z",
    }),
    listing({
      id: "c",
      status: "live",
      title: "Lekki studio",
      created_at: "2026-02-04T10:00:00.000Z",
      updated_at: "2026-02-06T10:00:00.000Z",
    }),
  ];

  const searched = filterAndSortHostProperties(rows, {
    ...baseQuery,
    search: "lekki",
    sort: "newest",
  });
  assert.deepEqual(
    searched.map((row) => row.id),
    ["c", "b"],
    "newest sort should prefer created_at desc within search results"
  );

  const updated = filterAndSortHostProperties(rows, {
    ...baseQuery,
    search: "lekki",
    sort: "updated",
  });
  assert.deepEqual(
    updated.map((row) => row.id),
    ["c", "b"],
    "updated sort should prefer updated_at desc within search results"
  );
});
