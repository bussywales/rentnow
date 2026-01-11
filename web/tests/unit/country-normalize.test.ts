import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCountryForCreate, normalizeCountryForUpdate } from "@/lib/properties/country-normalize";

void test("normalizeCountryForCreate uppercases code and derives name", () => {
  const result = normalizeCountryForCreate({ country_code: "ng" });
  assert.equal(result.country_code, "NG");
  assert.equal(result.country, "Nigeria");
});

void test("normalizeCountryForCreate derives code from name", () => {
  const result = normalizeCountryForCreate({ country: "Nigeria" });
  assert.equal(result.country, "Nigeria");
  assert.equal(result.country_code, "NG");
});

void test("normalizeCountryForCreate treats empty code as null", () => {
  const result = normalizeCountryForCreate({ country_code: "" });
  assert.equal(result.country_code, null);
  assert.equal(result.country, null);
});

void test("normalizeCountryForUpdate derives code from name", () => {
  const result = normalizeCountryForUpdate({ country: "United Kingdom" });
  assert.equal(result.country, "United Kingdom");
  assert.equal(result.country_code, "GB");
});

void test("normalizeCountryForUpdate derives name from code", () => {
  const result = normalizeCountryForUpdate({ country_code: "us" });
  assert.equal(result.country_code, "US");
  assert.equal(result.country, "United States");
});
