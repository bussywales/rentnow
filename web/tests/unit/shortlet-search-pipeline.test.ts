import assert from "node:assert/strict";
import test from "node:test";
import type { Property } from "@/lib/types";
import type { ShortletSearchFilters } from "@/lib/shortlet/search";
import { runShortletPreAvailabilityPipeline } from "@/lib/shortlet/search-pipeline";

function buildProperty(partial: Partial<Property>): Property {
  return {
    id: "property-1",
    owner_id: "owner-1",
    title: "Shortlet",
    city: "Lagos",
    rental_type: "short_let",
    listing_intent: "shortlet",
    price: 100000,
    currency: "NGN",
    bedrooms: 2,
    bathrooms: 2,
    furnished: true,
    latitude: 6.5,
    longitude: 3.35,
    amenities: ["wifi", "security", "gated estate", "inverter", "borehole"],
    shortlet_settings: [{ booking_mode: "request", cancellation_policy: "flexible_48h" }],
    ...partial,
  };
}

const FILTERS: ShortletSearchFilters = {
  where: "lagos",
  checkIn: null,
  checkOut: null,
  guests: 1,
  marketCountry: "NG",
  bounds: {
    north: 6.9,
    south: 6.1,
    east: 3.8,
    west: 3.1,
  },
  sort: "recommended",
  trust: {
    powerBackup: false,
    waterBorehole: false,
    security: false,
    wifi: true,
    verifiedHost: false,
  },
  provider: {
    bookingMode: "request",
    freeCancellation: true,
  },
  page: 1,
  pageSize: 24,
};

void test("pre-availability pipeline tracks stage counts and exclusion reasons", () => {
  const baselineRows: Property[] = [
    buildProperty({ id: "eligible" }),
    buildProperty({ id: "destination-miss", city: "London", country: "United Kingdom", country_code: "GB" }),
    buildProperty({ id: "bbox-miss", latitude: 51.5, longitude: -0.1 }),
    buildProperty({
      id: "booking-mode-miss",
      shortlet_settings: [{ booking_mode: "instant", cancellation_policy: "flexible_48h" }],
    }),
    buildProperty({
      id: "free-cancel-miss",
      shortlet_settings: [{ booking_mode: "request", cancellation_policy: "strict" }],
    }),
    buildProperty({ id: "trust-miss", amenities: ["security"] }),
  ];

  const result = runShortletPreAvailabilityPipeline({
    baselineRows,
    filters: FILTERS,
    verifiedHostIds: new Set<string>(),
    debugEnabled: true,
  });

  assert.equal(result.stageCounts.baselineCount, 6);
  assert.equal(result.stageCounts.destinationFilteredCount, 5);
  assert.equal(result.stageCounts.bboxFilteredCount, 4);
  assert.equal(result.stageCounts.providerFilteredCount, 1);
  assert.deepEqual(result.providerFilteredRows.map((row) => row.id), ["eligible"]);
  assert.deepEqual(Array.from(result.debugReasons.get("destination-miss") ?? []), ["destination_mismatch"]);
  assert.deepEqual(Array.from(result.debugReasons.get("bbox-miss") ?? []), ["bbox_mismatch"]);
  assert.deepEqual(Array.from(result.debugReasons.get("booking-mode-miss") ?? []), ["booking_mode_mismatch"]);
  assert.deepEqual(Array.from(result.debugReasons.get("free-cancel-miss") ?? []), ["free_cancellation_mismatch"]);
  assert.deepEqual(Array.from(result.debugReasons.get("trust-miss") ?? []), ["trust_filter_mismatch"]);
});

void test("pre-availability pipeline stays deterministic across repeated runs", () => {
  const baselineRows: Property[] = [
    buildProperty({ id: "eligible-1" }),
    buildProperty({ id: "eligible-2", shortlet_settings: [{ booking_mode: "request", cancellation_policy: "moderate_5d" }] }),
  ];

  const first = runShortletPreAvailabilityPipeline({
    baselineRows,
    filters: FILTERS,
    verifiedHostIds: new Set<string>(),
    debugEnabled: false,
  });

  const second = runShortletPreAvailabilityPipeline({
    baselineRows,
    filters: FILTERS,
    verifiedHostIds: new Set<string>(),
    debugEnabled: false,
  });

  assert.deepEqual(first.stageCounts, second.stageCounts);
  assert.deepEqual(
    first.providerFilteredRows.map((row) => row.id),
    second.providerFilteredRows.map((row) => row.id)
  );
  assert.equal(first.debugReasons.size, 0);
  assert.equal(second.debugReasons.size, 0);
});
