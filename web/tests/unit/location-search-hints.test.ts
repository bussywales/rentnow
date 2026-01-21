import test from "node:test";
import assert from "node:assert/strict";
import {
  looksLikePostalCode,
  countryNameFromCode,
  classifyLocationQuery,
  inferCountryFromResults,
  buildCountryHintKey,
  shouldShowCountryCta,
  countryCodeFromQueryType,
} from "@/lib/location/search-hints";

void test("looksLikePostalCode detects GB outward/inward codes", () => {
  assert.equal(looksLikePostalCode("ST6"), "GB");
  assert.equal(looksLikePostalCode("ST6 3EG"), "GB");
  assert.equal(classifyLocationQuery("W11 3EG"), "UK_POSTCODE");
});

void test("looksLikePostalCode detects US ZIP", () => {
  assert.equal(looksLikePostalCode("94105"), "US");
  assert.equal(classifyLocationQuery("94107-1234"), "US_ZIP");
});

void test("looksLikePostalCode detects CA postal", () => {
  assert.equal(looksLikePostalCode("M5V 2T6"), "CA");
  assert.equal(classifyLocationQuery("M5V"), "CA_FSA");
});

void test("looksLikePostalCode returns null for general text", () => {
  assert.equal(looksLikePostalCode("Ikoyi"), null);
  assert.equal(classifyLocationQuery("Ikoyi"), "NONE");
});

void test("generic postal-like queries fall back to generic type", () => {
  assert.equal(classifyLocationQuery("123A"), "GENERIC_POSTAL_LIKE");
});

void test("countryNameFromCode maps common codes", () => {
  assert.equal(countryNameFromCode("GB"), "United Kingdom");
  assert.equal(countryNameFromCode("NG"), "Nigeria");
  assert.equal(countryNameFromCode("US"), "United States");
  assert.equal(countryNameFromCode("CA"), "Canada");
});

void test("infers country when top results agree", () => {
  const inferred = inferCountryFromResults([
    { country_code: "gb" },
    { country_code: "GB" },
    { country_code: "gb" },
  ]);
  assert.equal(inferred, "GB");
});

void test("country CTA suppressed when country selected and reappears when cleared", () => {
  const key = buildCountryHintKey("UK_POSTCODE", countryCodeFromQueryType("UK_POSTCODE"));
  assert.equal(
    shouldShowCountryCta({ ctaKey: key, countrySelected: true, dismissedKey: key }),
    false
  );
  assert.equal(
    shouldShowCountryCta({ ctaKey: key, countrySelected: false, dismissedKey: null }),
    true
  );
});
