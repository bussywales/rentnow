import test from "node:test";
import assert from "node:assert/strict";
import { looksLikePostalCode, countryNameFromCode } from "@/lib/location/search-hints";

void test("looksLikePostalCode detects GB outward/inward codes", () => {
  assert.equal(looksLikePostalCode("ST6"), "GB");
  assert.equal(looksLikePostalCode("ST6 3EG"), "GB");
});

void test("looksLikePostalCode detects US ZIP", () => {
  assert.equal(looksLikePostalCode("94105"), "US");
});

void test("looksLikePostalCode detects CA postal", () => {
  assert.equal(looksLikePostalCode("M5V 2T6"), "CA");
});

void test("looksLikePostalCode returns null for general text", () => {
  assert.equal(looksLikePostalCode("Ikoyi"), null);
});

void test("countryNameFromCode maps common codes", () => {
  assert.equal(countryNameFromCode("GB"), "United Kingdom");
  assert.equal(countryNameFromCode("NG"), "Nigeria");
  assert.equal(countryNameFromCode("US"), "United States");
  assert.equal(countryNameFromCode("CA"), "Canada");
});
