import test from "node:test";
import assert from "node:assert/strict";
import {
  filterShortletListingsByMarket,
  mapShortletSearchRowsToResultItems,
  matchesTrustFilters,
  parseShortletSearchFilters,
  parseShortletSearchBounds,
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
  assert.deepEqual(filtered.map((row) => row.id), ["ng-1"]);
});

void test("shortlet search defaults market to NG", () => {
  const parsed = parseShortletSearchFilters(new URLSearchParams("q=lekki"));
  assert.equal(parsed.marketCountry, "NG");
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
  assert.equal(mapped.coverImageUrl, "https://example.com/img-1.jpg");
  assert.equal(mapped.cover_image_url, "https://example.com/img-1.jpg");
  assert.equal(mapped.imageCount, 2);
  assert.deepEqual(mapped.imageUrls, [
    "https://example.com/img-1.jpg",
    "https://example.com/img-2.jpg",
  ]);
  assert.equal(mapped.images?.[0]?.image_url, "https://example.com/img-1.jpg");
});
