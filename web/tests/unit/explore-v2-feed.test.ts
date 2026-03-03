import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExploreV2Feed } from "@/components/explore-v2/ExploreV2Feed";
import { resolveExploreV2PageData } from "@/app/explore-v2/page";
import type { Property } from "@/lib/types";

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
      marketCurrency: "NGN",
    })
  );

  assert.match(html, /data-testid="explore-v2-feed"/);
  const cardMatches = html.match(/data-testid="explore-v2-card"/g) ?? [];
  assert.ok(cardMatches.length >= 1, "expected explore-v2 cards to render for fixture listings");
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
  });

  assert.equal(data.listings.length, 1);
  assert.equal(data.listings[0]?.id, "fixture-1");
});
