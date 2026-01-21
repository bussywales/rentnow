import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMapboxFeature, type MapboxFeature } from "@/lib/geocode/normalize-location";

void test("normalizeMapboxFeature parses GB with district", () => {
  const feature: MapboxFeature = {
    id: "place.gb",
    place_name: "Burslem, Stoke-on-Trent, Staffordshire, England, United Kingdom",
    context: [
      { id: "country.gb", short_code: "gb", text: "United Kingdom" },
      { id: "region.eng", text: "England" },
      { id: "district.staff", text: "Staffordshire" },
      { id: "place.stoke", text: "Stoke-on-Trent" },
      { id: "postcode.st4", text: "ST4 7QB" },
    ],
  };
  const result = normalizeMapboxFeature(feature);
  assert.equal(result.country_code, "GB");
  assert.equal(result.admin_area_1, "England");
  assert.equal(result.admin_area_2, "Staffordshire");
  assert.equal(result.locality, "Stoke-on-Trent");
  assert.equal(result.sublocality, "Burslem");
  assert.equal(result.postal_code, "ST4 7QB");
});

void test("normalizeMapboxFeature parses NG with state/city", () => {
  const feature: MapboxFeature = {
    id: "place.ng",
    place_name: "Ikoyi, Lagos, Nigeria",
    context: [
      { id: "country.ng", short_code: "ng", text: "Nigeria" },
      { id: "region.lagos", text: "Lagos" },
      { id: "place.ikoyi", text: "Ikoyi" },
      { id: "neighborhood.ikoyi", text: "Ikoyi" },
    ],
  };
  const result = normalizeMapboxFeature(feature);
  assert.equal(result.country_code, "NG");
  assert.equal(result.admin_area_1, "Lagos");
  assert.equal(result.locality, "Ikoyi");
  assert.equal(result.sublocality, null);
});

void test("normalizeMapboxFeature parses US with state", () => {
  const feature: MapboxFeature = {
    id: "place.us",
    place_name: "San Francisco, California, United States",
    context: [
      { id: "country.us", short_code: "us", text: "United States" },
      { id: "region.ca", text: "California" },
      { id: "place.sf", text: "San Francisco" },
    ],
  };
  const result = normalizeMapboxFeature(feature);
  assert.equal(result.country_code, "US");
  assert.equal(result.admin_area_1, "California");
  assert.equal(result.locality, "San Francisco");
});

void test("normalizeMapboxFeature parses CA with province", () => {
  const feature: MapboxFeature = {
    id: "place.ca",
    place_name: "Toronto, Ontario, Canada",
    context: [
      { id: "country.ca", short_code: "ca", text: "Canada" },
      { id: "region.on", text: "Ontario" },
      { id: "place.toronto", text: "Toronto" },
    ],
  };
  const result = normalizeMapboxFeature(feature);
  assert.equal(result.country_code, "CA");
  assert.equal(result.admin_area_1, "Ontario");
  assert.equal(result.locality, "Toronto");
});
