import test from "node:test";
import assert from "node:assert/strict";
import { parseMapboxFeature } from "@/lib/geocode/parse";

const fixture = {
  id: "place.123",
  place_name: "Ikeja, Lagos, Nigeria",
  center: [3.35, 6.6],
  context: [
    { id: "country.abc", short_code: "ng", text: "Nigeria" },
    { id: "region.def", text: "Lagos State" },
    { id: "place.ghi", text: "Ikeja" },
    { id: "neighborhood.jkl", text: "Allen" },
  ],
};

void test("parseMapboxFeature extracts region/place/neighborhood", () => {
  const parsed = parseMapboxFeature(fixture, "Ikeja, Lagos, Nigeria");
  assert.ok(parsed);
  assert.equal(parsed?.country_code, "ng");
  assert.equal(parsed?.country_name, "Nigeria");
  assert.equal(parsed?.region_name, "Lagos State");
  assert.equal(parsed?.place_name, "Ikeja");
  assert.equal(parsed?.neighborhood_name, "Allen");
});

void test("parseMapboxFeature tolerates missing context", () => {
  const parsed = parseMapboxFeature({ id: "p", center: [1, 2] }, "Label");
  assert.ok(parsed);
  assert.equal(parsed?.country_code, null);
});

void test("parseMapboxFeature rejects invalid coords", () => {
  const parsed = parseMapboxFeature(
    { id: "p", center: [null as unknown as number, null as unknown as number] },
    "Label"
  );
  assert.equal(parsed, null);
});

void test("parseMapboxFeature leaves neighbourhood empty when not provided", () => {
  const feature = {
    id: "place.456",
    center: [10, 10],
    context: [{ id: "country.xyz", short_code: "FR", text: "France" }],
  };
  const parsed = parseMapboxFeature(feature as Record<string, unknown>, "France");
  assert.ok(parsed);
  assert.equal(parsed?.neighborhood_name, null);
  assert.equal(parsed?.locality_name, null);
  assert.equal(parsed?.district_name, null);
});

void test("parseMapboxFeature parses UK county and neighbourhood context", () => {
  const feature = {
    id: "place.123",
    center: [-2.1854, 53.0027],
    context: [
      { id: "country.826", text: "United Kingdom", short_code: "GB" },
      { id: "region.1234", text: "England" },
      { id: "district.5678", text: "Staffordshire" },
      { id: "place.9999", text: "Stoke-on-Trent" },
      { id: "neighborhood.8888", text: "Burslem" },
    ],
  };
  const parsed = parseMapboxFeature(feature as Record<string, unknown>, "Burslem, Stoke-on-Trent");
  assert.equal(parsed?.country_code?.toUpperCase(), "GB");
  assert.equal(parsed?.country_name, "United Kingdom");
  assert.equal(parsed?.region_name, "England");
  assert.equal(parsed?.district_name, "Staffordshire");
  assert.equal(parsed?.place_name, "Stoke-on-Trent");
  assert.equal(parsed?.neighborhood_name, "Burslem");
  assert.equal(parsed?.locality_name, null);
});
