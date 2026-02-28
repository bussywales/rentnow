import test from "node:test";
import assert from "node:assert/strict";
import { mockProperties } from "@/lib/mock";
import type { Property } from "@/lib/types";
import {
  resolveExplorePriceCopy,
  resolveExploreStayContextFromSearchParams,
} from "@/lib/explore/explore-presentation";

function buildBaseListing(): Property {
  return {
    ...mockProperties[0],
    currency: "GBP",
    price: 1000,
  };
}

void test("shortlet pricing shows From/night and omits estimated total when dates or guests are missing", () => {
  const shortlet = {
    ...buildBaseListing(),
    listing_intent: "shortlet" as const,
    rental_type: "short_let" as const,
    shortlet_settings: [{ booking_mode: "instant", nightly_price_minor: 12000 }],
  };

  const copy = resolveExplorePriceCopy(shortlet, {
    marketCurrency: "GBP",
    stayContext: { checkIn: null, checkOut: null, guests: null },
  });

  assert.match(copy.primary, /^From .+\/night$/);
  assert.equal(copy.estTotal, null);
});

void test("shortlet pricing includes estimated total only when both dates and guests are known", () => {
  const shortlet = {
    ...buildBaseListing(),
    listing_intent: "shortlet" as const,
    rental_type: "short_let" as const,
    shortlet_settings: [{ booking_mode: "request", nightly_price_minor: 12000 }],
  };

  const copy = resolveExplorePriceCopy(shortlet, {
    marketCurrency: "GBP",
    stayContext: { checkIn: "2026-03-10", checkOut: "2026-03-14", guests: 2 },
  });

  assert.match(copy.primary, /^From .+\/night$/);
  assert.match(copy.estTotal ?? "", /^Est\. total /);
  assert.match(copy.estTotal ?? "", /480/);
});

void test("rent pricing uses explicit monthly cadence copy", () => {
  const rentListing = {
    ...buildBaseListing(),
    listing_intent: "rent_lease" as const,
    rental_type: "long_term" as const,
    rent_period: "monthly" as const,
    price: 950,
  };

  const copy = resolveExplorePriceCopy(rentListing, { marketCurrency: "GBP" });
  assert.match(copy.primary, /\/month$/);
  assert.equal(copy.estTotal, null);
});

void test("buy pricing shows a single clear amount without cadence suffix", () => {
  const buyListing = {
    ...buildBaseListing(),
    listing_intent: "sale" as const,
    rental_type: "long_term" as const,
    price: 250000,
  };

  const copy = resolveExplorePriceCopy(buyListing, { marketCurrency: "GBP" });
  assert.doesNotMatch(copy.primary, /\/(month|year|night)$/);
  assert.equal(copy.estTotal, null);
});

void test("search params parser extracts flexible date and guest keys safely", () => {
  const params = new URLSearchParams("checkin=2026-03-10&checkout=2026-03-12&adults=3");
  const context = resolveExploreStayContextFromSearchParams(params);

  assert.equal(context.checkIn, "2026-03-10");
  assert.equal(context.checkOut, "2026-03-12");
  assert.equal(context.guests, 3);
});
