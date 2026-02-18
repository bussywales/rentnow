import test from "node:test";
import assert from "node:assert/strict";
import {
  filterShortletRowsByDateAvailability,
  filterShortletListingsByMarket,
  mapShortletSearchRowsToResultItems,
  matchesTrustFilters,
  parseShortletSearchFilters,
  parseShortletSearchBounds,
  resolveShortletPrimaryImageUrl,
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

void test("market=NG returns only NG listings", () => {
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

  const filtered = filterShortletListingsByMarket(rows, "NG");
  assert.deepEqual(filtered.map((row) => row.id), ["ng-1", "unknown-1"]);
});

void test("shortlet search defaults market to NG", () => {
  const parsed = parseShortletSearchFilters(new URLSearchParams("q=lekki"));
  assert.equal(parsed.marketCountry, "NG");
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
  assert.equal(mapped.coverImageUrl, "https://example.com/img-1.jpg");
  assert.equal(mapped.cover_image_url, "https://example.com/img-1.jpg");
  assert.equal(mapped.imageCount, 2);
  assert.deepEqual(mapped.imageUrls, [
    "https://example.com/img-1.jpg",
    "https://example.com/img-2.jpg",
  ]);
  assert.equal(mapped.images?.[0]?.image_url, "https://example.com/img-1.jpg");
  assert.equal(mapped.hasCoords, false);
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

  const marketRows = filterShortletListingsByMarket(baselineRows, "NG");
  assert.equal(marketRows.length, baselineRows.length);

  const availabilityUnconstrained = filterShortletRowsByDateAvailability({
    rows: marketRows,
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
});
