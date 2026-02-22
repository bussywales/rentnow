import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import type { Property } from "@/lib/types";
import type { ShortletSearchFilters } from "@/lib/shortlet/search";
import { runShortletPreAvailabilityPipeline } from "@/lib/shortlet/search-pipeline";

const PERF_DATASET_SIZE = 600;
const PERF_BUDGET_MS = 600;
const PERF_ITERATIONS = 5;

function buildPerfProperty(index: number): Property {
  const inLagos = index % 2 === 0;
  return {
    id: `perf-property-${index}`,
    owner_id: `owner-${Math.trunc(index / 3)}`,
    title: `Perf listing ${index}`,
    city: inLagos ? "Lagos" : "Abuja",
    neighbourhood: inLagos ? "Lekki" : "Wuse",
    country: "Nigeria",
    country_code: "NG",
    rental_type: "short_let",
    listing_intent: "shortlet",
    price: 85000 + index,
    currency: "NGN",
    bedrooms: 2,
    bathrooms: 2,
    furnished: true,
    latitude: 6.2 + ((index % 10) * 0.05),
    longitude: 3.1 + ((index % 10) * 0.05),
    amenities: ["wifi", "security", "gated estate", "inverter", "borehole"],
    shortlet_settings: [
      {
        booking_mode: index % 4 === 0 ? "instant" : "request",
        cancellation_policy: index % 5 === 0 ? "strict" : "flexible_48h",
      },
    ],
  };
}

const PERF_FILTERS: ShortletSearchFilters = {
  where: "lagos",
  checkIn: null,
  checkOut: null,
  guests: 2,
  marketCountry: "NG",
  bounds: {
    north: 7.4,
    south: 5.9,
    east: 3.9,
    west: 3.0,
  },
  sort: "recommended",
  trust: {
    powerBackup: true,
    waterBorehole: false,
    security: true,
    wifi: true,
    verifiedHost: false,
  },
  provider: {
    bookingMode: "request",
    freeCancellation: false,
  },
  page: 1,
  pageSize: 24,
};

void test("shortlet pre-availability pipeline stays under runtime budget for representative dataset", () => {
  const baselineRows = Array.from({ length: PERF_DATASET_SIZE }, (_, index) => buildPerfProperty(index));

  runShortletPreAvailabilityPipeline({
    baselineRows,
    filters: PERF_FILTERS,
    verifiedHostIds: new Set<string>(),
    debugEnabled: false,
  });

  const startedAt = performance.now();
  let resultCount = 0;

  for (let iteration = 0; iteration < PERF_ITERATIONS; iteration += 1) {
    const result = runShortletPreAvailabilityPipeline({
      baselineRows,
      filters: PERF_FILTERS,
      verifiedHostIds: new Set<string>(),
      debugEnabled: false,
    });
    resultCount += result.providerFilteredRows.length;
  }

  const durationMs = performance.now() - startedAt;
  assert.ok(resultCount > 0, "Pipeline should keep a representative eligible subset.");
  assert.ok(
    durationMs < PERF_BUDGET_MS,
    `Shortlet pre-availability pipeline budget exceeded: ${durationMs.toFixed(2)}ms >= ${PERF_BUDGET_MS}ms`
  );
});

