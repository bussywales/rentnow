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
  const parsed = parseMapboxFeature({ id: "p", center: [null as unknown as number, null as unknown as number] }, "Label");
  assert.equal(parsed, null);
});
