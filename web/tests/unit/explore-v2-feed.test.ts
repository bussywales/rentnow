import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EXPLORE_V2_DOCK_SAFE_ZONE_PX,
  ExploreV2Feed,
  filterExploreV2Listings,
  resolveExploreV2HeroPrefetchPlan,
} from "@/components/explore-v2/ExploreV2Feed";
import {
  createExploreV2DefaultFilters,
  ExploreV2Header,
  hasExploreV2ActiveFilters,
  resolveExploreV2FilterSummary,
} from "@/components/explore-v2/ExploreV2Header";
import { resolveExploreV2PageData } from "@/app/explore-v2/page";
import type { Property } from "@/lib/types";
import { resolveExploreHeroImageUrl } from "@/lib/explore/gallery-images";

function createExploreV2Listing(overrides: Partial<Property>): Property {
  return {
    id: "listing-1",
    owner_id: "owner-1",
    title: "Waterfront apartment",
    city: "Lagos",
    rental_type: "long_term",
    listing_intent: "rent_lease",
    price: 1500000,
    currency: "NGN",
    bedrooms: 2,
    bathrooms: 2,
    furnished: true,
    ...overrides,
  };
}

void test("explore-v2 feed renders root and cards for listing fixtures", () => {
  const listings = [
    createExploreV2Listing({ id: "listing-1", title: "Listing one" }),
    createExploreV2Listing({ id: "listing-2", title: "Listing two", city: "Abuja" }),
  ];
  const html = renderToStaticMarkup(
    React.createElement(ExploreV2Feed, {
      listings,
      marketCountry: "NG",
      marketCurrency: "NGN",
    })
  );

  assert.match(html, /data-testid="explore-v2-feed"/);
  assert.match(html, /data-testid="explore-v2-chip-row"/);
  assert.match(html, /data-testid="explore-v2-header-summary"/);
  const cardMatches = html.match(/data-testid="explore-v2-card"/g) ?? [];
  assert.ok(cardMatches.length >= 1, "expected explore-v2 cards to render for fixture listings");
  assert.match(html, />Explore<\/h1>/);
  assert.match(html, /data-testid="explore-v2-action-rail"/);
  assert.match(html, /data-testid="explore-v2-dock-safe-zone"/);
  assert.match(html, /class="[^"]*h-\[136px\][^"]*"/);
  assert.match(html, new RegExp(`height:${EXPLORE_V2_DOCK_SAFE_ZONE_PX}px`));
});

void test("explore-v2 page data resolver supports mocked server feed fixtures", async () => {
  const feedFixture = [createExploreV2Listing({ id: "fixture-1", title: "Fixture card" })];
  const data = await resolveExploreV2PageData({
    readHeaders: async () => new Headers(),
    readCookies: async () => ({
      get: () => undefined,
    }),
    loadMarketSettings: async () => ({
      defaultCountry: "NG",
      defaultCurrency: "NGN",
      autoDetectEnabled: true,
      selectorEnabled: true,
    }),
    loadExploreFeed: async () => feedFixture,
    loadAuthUser: async () => ({
      supabase: {} as never,
      user: null,
      sessionRefreshed: false,
    }),
  });

  assert.equal(data.listings.length, 1);
  assert.equal(data.listings[0]?.id, "fixture-1");
  assert.equal(data.viewerIsAuthenticated, false);
});

void test("explore-v2 hero resolver returns normalized hero url from property_images", () => {
  const hero = resolveExploreHeroImageUrl({
    images: [],
    property_images: [
      {
        id: "img-hero",
        image_url: "https://example.supabase.co/storage/v1/object/public/images/hero.jpg",
        blurhash: "L5H2EC=PM+yV0g-mq.wG9c010J}I",
        dominant_color: "#112233",
      },
    ],
  });

  assert.equal(
    hero.url,
    "https://example.supabase.co/storage/v1/object/public/images/hero.jpg"
  );
  assert.equal(hero.meta?.dominantColor, "#112233");
});

void test("explore-v2 hero resolver returns null when listing has no usable images", () => {
  const hero = resolveExploreHeroImageUrl({
    images: [],
    property_images: [],
    cover_image_url: null,
  });

  assert.equal(hero.url, null);
  assert.equal(hero.meta, null);
});

void test("explore-v2 listing filter applies market, type, beds, and budget locally", () => {
  const listings = [
    createExploreV2Listing({
      id: "ng-shortlet-2beds",
      listing_intent: "shortlet",
      rental_type: "short_let",
      bedrooms: 2,
      price: 900,
      currency: "NGN",
      country_code: "NG",
    }),
    createExploreV2Listing({
      id: "ng-rent-3beds",
      listing_intent: "rent_lease",
      rental_type: "long_term",
      bedrooms: 3,
      price: 1400,
      currency: "NGN",
      country_code: "NG",
    }),
    createExploreV2Listing({
      id: "gb-buy-4beds",
      listing_intent: "sale",
      rental_type: "long_term",
      bedrooms: 4,
      price: 3200,
      currency: "GBP",
      country_code: "GB",
    }),
  ];

  const baseline = createExploreV2DefaultFilters("ng");
  const filtered = filterExploreV2Listings({
    listings,
    filters: {
      ...baseline,
      type: "shortlets",
      beds: "2",
      budgetMin: 800,
      budgetMax: 1200,
    },
    fallbackMarketCountry: "NG",
  });

  assert.deepEqual(
    filtered.map((listing) => listing.id),
    ["ng-shortlet-2beds"]
  );
});

void test("explore-v2 filter helpers resolve active state and subtitle summary", () => {
  const defaultFilters = createExploreV2DefaultFilters("ng");
  assert.equal(hasExploreV2ActiveFilters(defaultFilters, "ng"), false);

  const activeFilters = {
    ...defaultFilters,
    type: "shortlets" as const,
    beds: "2" as const,
    budgetMin: 500,
    budgetMax: 1200,
  };
  assert.equal(hasExploreV2ActiveFilters(activeFilters, "ng"), true);
  assert.match(
    resolveExploreV2FilterSummary(activeFilters, "NGN"),
    /NG • Shortlets • 2\+ beds • ₦500-₦1,200/
  );
});

void test("explore-v2 header shows active chip state and clear-all action when filters are active", () => {
  const filters = {
    ...createExploreV2DefaultFilters("ng"),
    type: "shortlets" as const,
  };
  const html = renderToStaticMarkup(
    React.createElement(ExploreV2Header, {
      filters,
      defaultMarket: "ng",
      fallbackCurrency: "NGN",
      onApplyFilters: () => undefined,
      onClearAll: () => undefined,
    })
  );

  assert.match(html, /data-testid="explore-v2-chip-type"/);
  assert.match(html, /Type: Shortlets/);
  assert.match(html, /bg-slate-900\/62/);
  assert.match(html, /data-testid="explore-v2-clear-all"/);
});

void test("explore-v2 prefetch plan selects only the next hero url from top visible index", () => {
  const plan = resolveExploreV2HeroPrefetchPlan({
    topVisibleIndex: 3,
    totalListings: 8,
    heroImageUrls: [
      "https://cdn.example/0.jpg",
      "https://cdn.example/1.jpg",
      "https://cdn.example/2.jpg",
      "https://cdn.example/3.jpg",
      "https://cdn.example/4.jpg",
      "https://cdn.example/5.jpg",
      "https://cdn.example/6.jpg",
      "https://cdn.example/7.jpg",
    ],
    lookaheadCount: 2,
    maxInflight: 2,
    sessionCap: 20,
    completedUrls: new Set<string>(),
    inflightUrls: new Set<string>(),
  });

  assert.deepEqual(plan, ["https://cdn.example/4.jpg"]);
});

void test("explore-v2 prefetch plan respects session cap and inflight limits", () => {
  const plan = resolveExploreV2HeroPrefetchPlan({
    topVisibleIndex: 0,
    totalListings: 4,
    heroImageUrls: [
      "https://cdn.example/0.jpg",
      "https://cdn.example/1.jpg",
      "https://cdn.example/2.jpg",
      "https://cdn.example/3.jpg",
    ],
    lookaheadCount: 2,
    maxInflight: 2,
    sessionCap: 1,
    completedUrls: new Set<string>(),
    inflightUrls: new Set<string>(),
  });
  assert.deepEqual(plan, ["https://cdn.example/1.jpg"]);

  const blockedByInflight = resolveExploreV2HeroPrefetchPlan({
    topVisibleIndex: 0,
    totalListings: 4,
    heroImageUrls: [
      "https://cdn.example/0.jpg",
      "https://cdn.example/1.jpg",
      "https://cdn.example/2.jpg",
      "https://cdn.example/3.jpg",
    ],
    lookaheadCount: 2,
    maxInflight: 2,
    sessionCap: 20,
    completedUrls: new Set<string>(),
    inflightUrls: new Set<string>(["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"]),
  });
  assert.deepEqual(blockedByInflight, []);
});

void test("explore-v2 prefetch plan dedupes repeated range passes using completed urls", () => {
  const completedUrls = new Set<string>();
  const firstPass = resolveExploreV2HeroPrefetchPlan({
    topVisibleIndex: 0,
    totalListings: 4,
    heroImageUrls: [
      "https://cdn.example/0.jpg",
      "https://cdn.example/1.jpg",
      "https://cdn.example/2.jpg",
      "https://cdn.example/3.jpg",
    ],
    lookaheadCount: 2,
    maxInflight: 2,
    sessionCap: 20,
    completedUrls,
    inflightUrls: new Set<string>(),
  });
  assert.deepEqual(firstPass, ["https://cdn.example/1.jpg"]);

  completedUrls.add("https://cdn.example/1.jpg");
  const secondPass = resolveExploreV2HeroPrefetchPlan({
    topVisibleIndex: 0,
    totalListings: 4,
    heroImageUrls: [
      "https://cdn.example/0.jpg",
      "https://cdn.example/1.jpg",
      "https://cdn.example/2.jpg",
      "https://cdn.example/3.jpg",
    ],
    lookaheadCount: 2,
    maxInflight: 2,
    sessionCap: 20,
    completedUrls,
    inflightUrls: new Set<string>(),
  });
  assert.deepEqual(secondPass, []);
});
