import test from "node:test";
import assert from "node:assert/strict";
import { mockProperties } from "@/lib/mock";
import { buildExploreFeed, buildExploreSectionedFeed, flattenExploreSectionedFeed } from "@/lib/explore/explore-feed.server";
import {
  resolveExploreCtaMicrocopy,
  resolveExplorePrimaryAction,
  resolveExploreV2MicroSheetCtaLabels,
} from "@/lib/explore/explore-presentation";

void test("buildExploreFeed keeps featured-first deterministic order and caps at 20 by default", () => {
  const featured = mockProperties.slice(0, 4);
  const browse = [...mockProperties.slice(2, 20), ...featured];

  const feed = buildExploreFeed({ featured, browse });
  const ids = feed.map((item) => item.id);

  assert.ok(feed.length <= 20);
  assert.equal(ids[0], featured[0]?.id);
  assert.equal(ids[1], featured[1]?.id);
  assert.equal(new Set(ids).size, ids.length);
});

void test("buildExploreFeed supports explicit page size for prototype", () => {
  const feed = buildExploreFeed({
    featured: mockProperties.slice(0, 2),
    browse: mockProperties.slice(0, 10),
    limit: 8,
  });
  assert.equal(feed.length, 8);
});

void test("resolveExplorePrimaryAction switches CTA by listing type", () => {
  const shortlet = {
    ...mockProperties[0],
    listing_intent: "shortlet" as const,
    rental_type: "short_let" as const,
  };
  const longTerm = {
    ...mockProperties[1],
    listing_intent: "rent_lease" as const,
    rental_type: "long_term" as const,
  };

  assert.equal(resolveExplorePrimaryAction(shortlet).label, "Book");
  assert.equal(resolveExplorePrimaryAction(longTerm).label, "Request viewing");
  assert.match(resolveExploreCtaMicrocopy(shortlet), /Secure checkout/i);
  assert.match(resolveExploreCtaMicrocopy(longTerm), /No commitment/i);
});

void test("resolveExploreV2MicroSheetCtaLabels keeps CTA meaning truthful by intent and variant", () => {
  const shortlet = {
    ...mockProperties[0],
    listing_intent: "shortlet" as const,
    rental_type: "short_let" as const,
  };
  const instantShortlet = {
    ...shortlet,
    shortlet_settings: [{ booking_mode: "instant" as const }],
  };
  const rent = {
    ...mockProperties[1],
    listing_intent: "rent_lease" as const,
    rental_type: "long_term" as const,
  };

  assert.equal(
    resolveExploreV2MicroSheetCtaLabels({ property: shortlet, variant: "default" }).primaryLabel,
    "Book"
  );
  assert.equal(
    resolveExploreV2MicroSheetCtaLabels({ property: shortlet, variant: "clarity" }).primaryLabel,
    "Check availability"
  );
  assert.equal(
    resolveExploreV2MicroSheetCtaLabels({ property: shortlet, variant: "action" }).primaryLabel,
    "Start booking"
  );
  assert.equal(
    resolveExploreV2MicroSheetCtaLabels({ property: instantShortlet, variant: "action" }).primaryLabel,
    "Book instantly"
  );
  assert.equal(
    resolveExploreV2MicroSheetCtaLabels({ property: rent, variant: "clarity" }).primaryLabel,
    "Request viewing"
  );
});

void test("flattenExploreSectionedFeed returns market picks then fallback listings", () => {
  const market = {
    ...mockProperties[0],
    id: "market-a",
    country_code: "NG",
  };
  const fallback = {
    ...mockProperties[1],
    id: "fallback-a",
    country_code: "GB",
  };
  const sectioned = buildExploreSectionedFeed([market, fallback], {
    marketCountry: "NG",
    limit: 20,
  });

  assert.deepEqual(
    flattenExploreSectionedFeed(sectioned).map((listing) => listing.id),
    ["market-a", "fallback-a"]
  );
});
