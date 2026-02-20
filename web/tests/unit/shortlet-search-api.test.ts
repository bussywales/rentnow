import test from "node:test";
import assert from "node:assert/strict";
import {
  filterShortletRowsByDateAvailability,
  isWithinBounds,
  matchesFreeCancellationFilter,
  matchesShortletDestination,
  mapShortletSearchRowsToResultItems,
  matchesTrustFilters,
  parseShortletSearchBbox,
  parseShortletSearchFilters,
  parseShortletSearchBounds,
  scoreShortletRecommendedListing,
  resolveShortletPrimaryImageUrl,
  isShortletPlaceholderImageUrl,
  sortShortletSearchResults,
  unavailablePropertyIdsForDateRange,
} from "@/lib/shortlet/search";
import type { Property } from "@/lib/types";

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
    ...partial,
  };
}

void test("date overlap helper excludes unavailable listings and allows back-to-back", () => {
  const unavailable = unavailablePropertyIdsForDateRange({
    checkIn: "2026-03-10",
    checkOut: "2026-03-12",
    bookedOverlaps: [
      { property_id: "a", start: "2026-03-09", end: "2026-03-11" },
      { property_id: "b", start: "2026-03-12", end: "2026-03-14" },
    ],
    blockedOverlaps: [{ property_id: "c", start: "2026-03-10", end: "2026-03-10" }],
  });

  assert.equal(unavailable.has("a"), true);
  assert.equal(unavailable.has("b"), false);
  assert.equal(unavailable.has("c"), false);
});

void test("trust filters require amenities and verified host signals", () => {
  const property = buildProperty({
    amenities: ["wifi", "inverter", "borehole", "security", "gated estate"],
  });
  const passes = matchesTrustFilters({
    property,
    trustFilters: {
      powerBackup: true,
      waterBorehole: true,
      security: true,
      wifi: true,
      verifiedHost: true,
    },
    verifiedHostIds: new Set(["owner-1"]),
  });
  assert.equal(passes, true);

  const fails = matchesTrustFilters({
    property: buildProperty({
      owner_id: "owner-2",
      amenities: ["wifi"],
    }),
    trustFilters: {
      powerBackup: true,
      waterBorehole: false,
      security: false,
      wifi: true,
      verifiedHost: true,
    },
    verifiedHostIds: new Set<string>(),
  });
  assert.equal(fails, false);
});

void test("free cancellation filter keeps flexible policies and excludes strict", () => {
  const flexible = buildProperty({
    id: "flexible",
    shortlet_settings: [{ cancellation_policy: "flexible_48h" }],
  });
  const strict = buildProperty({
    id: "strict",
    shortlet_settings: [{ cancellation_policy: "strict" }],
  });

  assert.equal(
    matchesFreeCancellationFilter({
      property: flexible,
      freeCancellationOnly: true,
    }),
    true
  );
  assert.equal(
    matchesFreeCancellationFilter({
      property: strict,
      freeCancellationOnly: true,
    }),
    false
  );
  assert.equal(
    matchesFreeCancellationFilter({
      property: strict,
      freeCancellationOnly: false,
    }),
    true
  );
});

void test("bounds parser accepts valid bounds and rejects invalid input", () => {
  assert.deepEqual(parseShortletSearchBounds("6.9,6.3,3.7,3.2"), {
    north: 6.9,
    south: 6.3,
    east: 3.7,
    west: 3.2,
  });
  assert.equal(parseShortletSearchBounds("bad"), null);
  assert.equal(parseShortletSearchBounds("6.3,6.9,3.7,3.2"), null);
});

void test("where empty keeps global listings and where=nigeria narrows to nigeria", () => {
  const rows: Property[] = [
    buildProperty({
      id: "ng-1",
      country_code: "NG",
      country: "Nigeria",
      latitude: 9.08,
      longitude: 8.67,
    }),
    buildProperty({
      id: "gb-1",
      country_code: "GB",
      country: "United Kingdom",
      latitude: 51.5,
      longitude: -0.12,
    }),
    buildProperty({
      id: "unknown-1",
      country_code: null,
      country: null,
    }),
  ];

  const globalRows = rows.filter((row) => matchesShortletDestination(row, null));
  assert.deepEqual(
    globalRows.map((row) => row.id),
    ["ng-1", "gb-1", "unknown-1"]
  );

  const nigeriaRows = rows.filter((row) => matchesShortletDestination(row, "Nigeria"));
  assert.deepEqual(nigeriaRows.map((row) => row.id), ["ng-1"]);
});

void test("shortlet search defaults market to NG", () => {
  const parsed = parseShortletSearchFilters(new URLSearchParams("where=lekki"));
  assert.equal(parsed.marketCountry, "NG");
});

void test("shortlet search supports bbox and where params", () => {
  const parsed = parseShortletSearchFilters(
    new URLSearchParams(
      "where=abuja&bbox=7.7,9.0,7.9,9.2&market=NG"
    )
  );
  assert.equal(parsed.where, "abuja");
  assert.deepEqual(parsed.bounds, {
    north: 9.2,
    south: 9.0,
    east: 7.9,
    west: 7.7,
  });
});

void test("shortlet search sort parser accepts legacy and canonical sort params", () => {
  const legacy = parseShortletSearchFilters(new URLSearchParams("sort=price_low"));
  const canonical = parseShortletSearchFilters(new URLSearchParams("sort=price_asc"));
  const rating = parseShortletSearchFilters(new URLSearchParams("sort=rating"));

  assert.equal(legacy.sort, "price_asc");
  assert.equal(canonical.sort, "price_asc");
  assert.equal(rating.sort, "rating");
});

void test("bbox parser accepts lng/lat order and bounds checks filter by coordinates", () => {
  const bounds = parseShortletSearchBbox("3.2,6.2,3.9,6.8");
  assert.deepEqual(bounds, {
    north: 6.8,
    south: 6.2,
    east: 3.9,
    west: 3.2,
  });

  const inside = buildProperty({ latitude: 6.5, longitude: 3.5 });
  const outside = buildProperty({ latitude: 8.0, longitude: 4.1 });
  assert.equal(isWithinBounds(inside, bounds), true);
  assert.equal(isWithinBounds(outside, bounds), false);
});

void test("recommended shortlet sorting prioritizes verified hosts and value", () => {
  const rows: Property[] = [
    buildProperty({
      id: "a",
      owner_id: "owner-a",
      shortlet_settings: [{ booking_mode: "request", nightly_price_minor: 70000 }],
      latitude: 6.5,
      longitude: 3.3,
    }),
    buildProperty({
      id: "b",
      owner_id: "owner-b",
      shortlet_settings: [{ booking_mode: "instant", nightly_price_minor: 65000 }],
      latitude: 6.51,
      longitude: 3.31,
    }),
  ];

  const sorted = sortShortletSearchResults(rows, "recommended", {
    verifiedHostIds: new Set(["owner-a"]),
    recommendedCenter: { latitude: 6.5, longitude: 3.3 },
  });
  assert.deepEqual(sorted.map((item) => item.id), ["a", "b"]);
});

void test("rating sort gracefully falls back when rating data is missing", () => {
  const rows: Property[] = [
    buildProperty({ id: "older", created_at: "2026-01-01T00:00:00.000Z" }),
    buildProperty({ id: "newer", created_at: "2026-02-01T00:00:00.000Z" }),
  ];

  const sorted = sortShortletSearchResults(rows, "rating");
  assert.deepEqual(sorted.map((row) => row.id), ["newer", "older"]);
});

void test("recommended sort is deterministic and keeps priced listings above price-on-request ties", () => {
  const rows: Property[] = [
    buildProperty({
      id: "priced",
      owner_id: "owner-z",
      shortlet_settings: [{ booking_mode: "request", nightly_price_minor: 50000 }],
      created_at: "2026-02-18T12:00:00.000Z",
      updated_at: "2026-02-18T12:00:00.000Z",
    }),
    buildProperty({
      id: "request-price-on-request",
      owner_id: "owner-y",
      shortlet_settings: [{ booking_mode: "request", nightly_price_minor: null }],
      created_at: "2026-02-18T12:00:00.000Z",
      updated_at: "2026-02-18T12:00:00.000Z",
    }),
  ];

  const firstRun = sortShortletSearchResults(rows, "recommended");
  const secondRun = sortShortletSearchResults(rows, "recommended");
  assert.deepEqual(firstRun.map((row) => row.id), ["priced", "request-price-on-request"]);
  assert.deepEqual(secondRun.map((row) => row.id), ["priced", "request-price-on-request"]);
});

void test("recommended scoring rewards trust, images, and instant mode", () => {
  const trusted = buildProperty({
    id: "trusted",
    owner_id: "owner-trusted",
    shortlet_settings: [{ booking_mode: "request", nightly_price_minor: 45000 }],
    cover_image_url: "https://cdn.example.com/real-card.jpg",
  });
  const instant = buildProperty({
    id: "instant",
    owner_id: "owner-instant",
    shortlet_settings: [{ booking_mode: "instant", nightly_price_minor: 45000 }],
    cover_image_url: "https://images.unsplash.com/photo-1505691938895-1758d7feb511",
  });

  const trustedScore = scoreShortletRecommendedListing({
    property: trusted,
    verifiedHost: true,
    hasDateRange: true,
    applyNigeriaBoost: false,
    primaryImageUrl: trusted.cover_image_url,
  });
  const instantScore = scoreShortletRecommendedListing({
    property: instant,
    verifiedHost: false,
    hasDateRange: true,
    applyNigeriaBoost: false,
    primaryImageUrl: instant.cover_image_url,
  });

  assert.equal(isShortletPlaceholderImageUrl(trusted.cover_image_url), false);
  assert.equal(isShortletPlaceholderImageUrl(instant.cover_image_url), true);
  assert.equal(trustedScore > instantScore, true);
});

void test("shortlet search result items expose canonical cover image fields", () => {
  const rows = [
    {
      ...buildProperty({
        id: "with-photos",
        cover_image_url: null,
      }),
      property_images: [
        {
          id: "img-1",
          image_url: "https://example.com/img-1.jpg",
          position: 0,
        },
        {
          id: "img-2",
          image_url: "https://example.com/img-2.jpg",
          position: 1,
        },
      ],
    },
  ];

  const [mapped] = mapShortletSearchRowsToResultItems(rows);
  assert.ok(mapped);
  assert.equal(mapped.primaryImageUrl, "https://example.com/img-1.jpg");
  assert.equal(mapped.mapPreviewImageUrl, "https://example.com/img-1.jpg");
  assert.equal(mapped.coverImageUrl, "https://example.com/img-1.jpg");
  assert.equal(mapped.cover_image_url, "https://example.com/img-1.jpg");
  assert.equal(mapped.imageCount, 2);
  assert.deepEqual(mapped.imageUrls, [
    "https://example.com/img-1.jpg",
    "https://example.com/img-2.jpg",
  ]);
  assert.equal(mapped.pricingMode, "price_on_request");
  assert.equal(mapped.nightlyPrice, null);
  assert.equal(mapped.nights, null);
  assert.equal(mapped.subtotal, null);
  assert.equal(mapped.feeTotal, null);
  assert.equal(mapped.feesIncluded, false);
  assert.equal(mapped.total, null);
  assert.equal(mapped.images?.[0]?.image_url, "https://example.com/img-1.jpg");
  assert.equal(mapped.hasCoords, false);
});

void test("shortlet search mapping includes nightly and date totals when check-in/out are provided", () => {
  const rows = [
    {
      ...buildProperty({
        id: "priced",
        shortlet_settings: [{ nightly_price_minor: 4500000, booking_mode: "request" }],
        cover_image_url: "https://example.com/cover.jpg",
      }),
      property_images: [],
    },
  ];

  const [mapped] = mapShortletSearchRowsToResultItems(rows, {
    checkIn: "2026-03-10",
    checkOut: "2026-03-13",
    feePolicy: {
      serviceFeePct: 0,
      cleaningFee: 0,
      taxPct: 0,
    },
  });

  assert.equal(mapped.nightlyPriceMinor, 4500000);
  assert.equal(mapped.nightlyPrice, 45000);
  assert.equal(mapped.pricingMode, "nightly");
  assert.equal(mapped.nights, 3);
  assert.equal(mapped.subtotal, 135000);
  assert.deepEqual(mapped.fees, {
    serviceFee: 0,
    cleaningFee: 0,
    taxes: 0,
  });
  assert.equal(mapped.feeTotal, 0);
  assert.equal(mapped.feesIncluded, false);
  assert.equal(mapped.total, 135000);
});

void test("shortlet search mapping marks feesIncluded when fee total is positive", () => {
  const rows = [
    {
      ...buildProperty({
        id: "priced-with-fees",
        shortlet_settings: [{ nightly_price_minor: 5000000, booking_mode: "request" }],
      }),
      property_images: [],
    },
  ];

  const [mapped] = mapShortletSearchRowsToResultItems(rows, {
    checkIn: "2026-03-10",
    checkOut: "2026-03-12",
    feePolicy: {
      serviceFeePct: 2.5,
      cleaningFee: 6000,
      taxPct: 1,
    },
  });

  assert.equal(mapped.feeTotal, 9500);
  assert.equal(mapped.feesIncluded, true);
  assert.equal(mapped.total, 109500);
});

void test("map/list decoupling keeps list items without coords while map can skip them", () => {
  const rows = [
    buildProperty({
      id: "coords",
      latitude: 6.52,
      longitude: 3.37,
      cover_image_url: "https://example.com/coords.jpg",
    }),
    buildProperty({
      id: "no-coords",
      latitude: null,
      longitude: null,
      cover_image_url: "https://example.com/no-coords.jpg",
    }),
  ];
  const mapped = mapShortletSearchRowsToResultItems(rows);
  assert.equal(mapped.length, 2);
  assert.deepEqual(
    mapped.filter((item) => item.hasCoords).map((item) => item.id),
    ["coords"]
  );
});

void test("availability filtering applies only when valid date range is present", () => {
  const rows = [
    buildProperty({ id: "available" }),
    buildProperty({ id: "busy" }),
  ];
  const bookedOverlaps = [{ property_id: "busy", start: "2026-03-10", end: "2026-03-12" }];

  const withoutDates = filterShortletRowsByDateAvailability({
    rows,
    checkIn: null,
    checkOut: null,
    bookedOverlaps,
    blockedOverlaps: [],
  });
  assert.deepEqual(
    withoutDates.rows.map((row) => row.id).sort(),
    ["available", "busy"]
  );

  const withDates = filterShortletRowsByDateAvailability({
    rows,
    checkIn: "2026-03-10",
    checkOut: "2026-03-11",
    bookedOverlaps,
    blockedOverlaps: [],
  });
  assert.deepEqual(withDates.rows.map((row) => row.id), ["available"]);
  assert.equal(withDates.unavailablePropertyIds.has("busy"), true);
});

void test("no-date shortlet baseline remains abundant for nigeria market", () => {
  const baselineRows: Property[] = Array.from({ length: 7 }).map((_, index) =>
    buildProperty({
      id: `listing-${index + 1}`,
      country_code: index < 4 ? "NG" : null,
      country: index < 4 ? "Nigeria" : null,
      currency: "NGN",
      latitude: index % 2 === 0 ? 6.5 + index * 0.01 : null,
      longitude: index % 2 === 0 ? 3.3 + index * 0.01 : null,
      shortlet_settings:
        index % 3 === 0
          ? [{ booking_mode: "request", nightly_price_minor: 45000 + index * 1000 }]
          : [],
    })
  );

  const availabilityUnconstrained = filterShortletRowsByDateAvailability({
    rows: baselineRows,
    checkIn: null,
    checkOut: null,
    bookedOverlaps: [
      { property_id: "listing-1", start: "2026-03-10", end: "2026-03-12" },
      { property_id: "listing-2", start: "2026-03-11", end: "2026-03-13" },
    ],
    blockedOverlaps: [{ property_id: "listing-3", start: "2026-03-10", end: "2026-03-11" }],
  });

  assert.equal(availabilityUnconstrained.rows.length, baselineRows.length);
});

void test("primary image resolver supports cover, images array, and property_images cascade", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  const fromCover = resolveShortletPrimaryImageUrl(
    buildProperty({
      cover_image_url: "https://example.com/cover.jpg",
    }) as Property & {
      property_images?: Array<{ id?: string; image_url?: string; position?: number }>;
    }
  );
  assert.equal(fromCover, "https://example.com/cover.jpg");

  const fromImages = resolveShortletPrimaryImageUrl(
    buildProperty({
      cover_image_url: null,
      images: [
        { id: "img-1", image_url: "https://example.com/images-array.jpg", position: 0 },
      ],
    }) as Property & {
      property_images?: Array<{ id?: string; image_url?: string; position?: number }>;
    }
  );
  assert.equal(fromImages, "https://example.com/images-array.jpg");

  const fromPropertyImages = resolveShortletPrimaryImageUrl(
    {
      ...buildProperty({
        cover_image_url: null,
        images: [],
      }),
      property_images: [
        { id: "img-2", image_url: "https://example.com/property-images.jpg", position: 0 },
      ],
    } as Property & {
      property_images?: Array<{ id?: string; image_url?: string; position?: number }>;
    }
  );
  assert.equal(fromPropertyImages, "https://example.com/property-images.jpg");

  const fromDerivativePath = resolveShortletPrimaryImageUrl(
    {
      ...buildProperty({
        cover_image_url: null,
        images: [],
      }),
      property_images: [
        {
          id: "img-3",
          image_url: "https://example.com/legacy-original.jpg",
          position: 0,
          card_storage_path: "properties/p-1/img-3/card.webp",
        },
      ],
    } as Property & {
      property_images?: Array<{
        id?: string;
        image_url?: string;
        position?: number;
        card_storage_path?: string | null;
      }>;
    }
  );
  assert.equal(
    fromDerivativePath,
    "https://example.supabase.co/storage/v1/object/public/property-images/properties/p-1/img-3/card.webp"
  );
});
