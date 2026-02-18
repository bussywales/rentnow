import test from "node:test";
import assert from "node:assert/strict";
import {
  canRoleManageShortletSettings,
  resolveShortletManageState,
} from "@/lib/shortlet/manage-state";

void test("landlord role can manage canonical shortlet listings", () => {
  const state = resolveShortletManageState({
    listing_intent: "shortlet",
    rental_type: "short_let",
    listing_currency: "NGN",
  });
  assert.equal(canRoleManageShortletSettings("landlord"), true);
  assert.equal(state.isManageable, true);
  assert.equal(state.reason, "ok");
});

void test("mixed schema listing requires conversion CTA", () => {
  const state = resolveShortletManageState({
    listing_intent: "rent_lease",
    rental_type: "short_let",
    shortlet_settings: [{ booking_mode: "request", nightly_price_minor: 900000 }],
    listing_currency: "NGN",
  });
  assert.equal(state.isManageable, false);
  assert.equal(state.requiresConversion, true);
  assert.equal(state.reason, "shortlet_signal_without_intent");
});

void test("market mismatch is flagged for clearer host messaging", () => {
  const state = resolveShortletManageState({
    listing_intent: "shortlet",
    rental_type: "short_let",
    listing_currency: "NGN",
    selected_market_country: "GB",
    selected_market_currency: "GBP",
  });
  assert.equal(state.marketMismatch, true);
});
