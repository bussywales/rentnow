import test from "node:test";
import assert from "node:assert/strict";
import { formatListingTitle } from "@/lib/ui/format-listing-title";

void test("formatListingTitle normalizes all-caps titles to premium title case", () => {
  assert.equal(formatListingTitle("DETACHED DUPLEXES WITH B"), "Detached Duplexes With B");
});

void test("formatListingTitle preserves numerals and roman numerals", () => {
  assert.equal(formatListingTitle("4 BED DUPLEX - IKEJA PHASE II"), "4 Bed Duplex - Ikeja Phase II");
});

void test("formatListingTitle preserves known acronyms and Wi-Fi casing", () => {
  assert.equal(formatListingTitle("CCTV AND AC WITH WIFI"), "CCTV And AC With Wi-Fi");
});

void test("formatListingTitle keeps numeric and hyphenated tokens stable", () => {
  assert.equal(formatListingTitle("4-BED DUPLEX"), "4-Bed Duplex");
  assert.equal(formatListingTitle("3BR MINI FLAT"), "3BR Mini Flat");
  assert.equal(formatListingTitle("16SQM STUDIO"), "16sqm Studio");
});

void test("formatListingTitle handles extra spaces and lowercases small words in mixed-case input", () => {
  assert.equal(
    formatListingTitle("  cozy   apartment in   victoria  island  "),
    "Cozy Apartment in Victoria Island"
  );
});

void test("formatListingTitle preserves intentional mixed casing", () => {
  assert.equal(formatListingTitle("deVinci studio near NYC"), "deVinci Studio Near NYC");
});

void test("formatListingTitle handles empty/whitespace input safely", () => {
  assert.equal(formatListingTitle(""), "");
  assert.equal(formatListingTitle("    "), "");
});
