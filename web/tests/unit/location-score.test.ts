import test from "node:test";
import assert from "node:assert/strict";
import { computeLocationScore, extractLocationQuery } from "@/lib/properties/location-score";

type TestProperty = Parameters<typeof computeLocationScore>[0];

const buildProperty = (overrides: Partial<TestProperty>): TestProperty => ({
  postal_code: null,
  admin_area_1: null,
  admin_area_2: null,
  city: "",
  country_code: null,
  ...overrides,
});

void test("extractLocationQuery detects region-specific postal prefixes", () => {
  assert.equal(extractLocationQuery("ST6 3EG").postalPrefix, "ST6");
  assert.equal(extractLocationQuery("94105-1234").postalPrefix, "94105");
  assert.equal(extractLocationQuery("M5V 2T6").postalPrefix, "M5V");
});

void test("GB queries boost Stoke-on-Trent admin area and ST6 postal prefix", () => {
  const queryInfo = extractLocationQuery("Burslem Stoke-on-Trent ST6");
  const stoke = buildProperty({
    city: "Burslem",
    admin_area_1: "England",
    admin_area_2: "Stoke-on-Trent",
    postal_code: "ST6 3EG",
    country_code: "GB",
  });
  const nearby = buildProperty({
    city: "Burslem",
    admin_area_1: "England",
    admin_area_2: "Staffordshire Moorlands",
    postal_code: "ST13 8XX",
    country_code: "GB",
  });
  const canadianNoise = buildProperty({
    city: "Burslem",
    admin_area_1: "Ontario",
    admin_area_2: "Toronto",
    postal_code: "M5V 1B1",
    country_code: "CA",
  });

  const stokeScore = computeLocationScore(stoke, queryInfo);
  const nearbyScore = computeLocationScore(nearby, queryInfo);
  const canadianScore = computeLocationScore(canadianNoise, queryInfo);

  assert.ok(stokeScore > nearbyScore, "ST6 Stoke-on-Trent listing should rank higher");
  assert.ok(nearbyScore > canadianScore, "Non-GB noise should rank last");
});

void test("NG queries prefer city/neighbourhood and then admin area/country", () => {
  const queryInfo = extractLocationQuery("Ikoyi Lagos NG");
  const ikoyi = buildProperty({
    city: "Ikoyi",
    admin_area_1: "Lagos",
    admin_area_2: "Eti-Osa",
    country_code: "NG",
  });
  const lagosOnly = buildProperty({
    city: "Victoria Island",
    admin_area_1: "Lagos",
    admin_area_2: "Eti-Osa",
    country_code: "NG",
  });
  const otherCountry = buildProperty({
    city: "Ikoyi",
    admin_area_1: "Greater Accra",
    admin_area_2: "Accra",
    country_code: "GH",
  });

  const ikoyiScore = computeLocationScore(ikoyi, queryInfo);
  const lagosScore = computeLocationScore(lagosOnly, queryInfo);
  const otherScore = computeLocationScore(otherCountry, queryInfo);

  assert.ok(ikoyiScore > lagosScore, "City/neighbourhood match should lead");
  assert.ok(lagosScore > otherScore, "Admin area + country should beat non-NG matches");
});

void test("US ZIP prefixes boost matching postal codes", () => {
  const queryInfo = extractLocationQuery("94105");
  const soma = buildProperty({
    city: "San Francisco",
    admin_area_1: "California",
    admin_area_2: "San Francisco County",
    postal_code: "94105",
    country_code: "US",
  });
  const mission = buildProperty({
    city: "San Francisco",
    admin_area_1: "California",
    admin_area_2: "San Francisco County",
    postal_code: "94110",
    country_code: "US",
  });

  const somaScore = computeLocationScore(soma, queryInfo);
  const missionScore = computeLocationScore(mission, queryInfo);

  assert.ok(somaScore > missionScore, "94105 should outrank other ZIPs");
});

void test("CA postal prefixes lift matching FSAs", () => {
  const queryInfo = extractLocationQuery("M5V");
  const toronto = buildProperty({
    city: "Toronto",
    admin_area_1: "Ontario",
    admin_area_2: "Toronto",
    postal_code: "M5V 2T6",
    country_code: "CA",
  });
  const ottawa = buildProperty({
    city: "Ottawa",
    admin_area_1: "Ontario",
    admin_area_2: "Ottawa",
    postal_code: "K1A 0B1",
    country_code: "CA",
  });

  const torontoScore = computeLocationScore(toronto, queryInfo);
  const ottawaScore = computeLocationScore(ottawa, queryInfo);

  assert.ok(torontoScore > ottawaScore, "M5V listings should rank above other FSAs");
});
