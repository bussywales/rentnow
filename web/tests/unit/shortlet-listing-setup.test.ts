import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveCurrencyDefaultForCountry,
  resolveRentalTypeForListingIntent,
  resolveShortletPersistenceInput,
} from "@/lib/shortlet/listing-setup";

void test("shortlet intent forces rental type to short-let", () => {
  assert.equal(resolveRentalTypeForListingIntent("shortlet", "long_term"), "short_let");
  assert.equal(resolveRentalTypeForListingIntent("rent_lease", "long_term"), "long_term");
});

void test("nigeria market defaults listing currency to NGN unless user overrides", () => {
  assert.equal(
    resolveCurrencyDefaultForCountry({
      countryCode: "NG",
      currentCurrency: "USD",
      hasUserOverride: false,
    }),
    "NGN"
  );
  assert.equal(
    resolveCurrencyDefaultForCountry({
      countryCode: "NG",
      currentCurrency: "USD",
      hasUserOverride: true,
    }),
    "USD"
  );
});

void test("shortlet persistence prefers nightly pricing and prepares settings payload", () => {
  const resolved = resolveShortletPersistenceInput({
    listingIntent: "shortlet",
    rentalType: "long_term",
    nightlyPriceMinor: 125000,
    bookingMode: "instant",
    fallbackPrice: 50000,
  });
  assert.equal(resolved.isShortlet, true);
  assert.equal(resolved.rentalType, "short_let");
  assert.equal(resolved.bookingMode, "instant");
  assert.equal(resolved.nightlyPriceMinor, 125000);
});

void test("property stepper renders shortlet nightly pricing and booking mode controls", () => {
  const stepperPath = path.join(process.cwd(), "components", "properties", "PropertyStepper.tsx");
  const source = fs.readFileSync(stepperPath, "utf8");

  assert.match(source, /id="field-shortlet_nightly_price_minor"/);
  assert.match(source, /id="field-shortlet_booking_mode"/);
  assert.match(source, /id="rental-type-shortlet"/);
  assert.match(source, /disabled/);
});
