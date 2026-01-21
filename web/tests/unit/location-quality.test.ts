import test from "node:test";
import assert from "node:assert/strict";
import { computeLocationQuality } from "@/lib/properties/location-quality";

const PIN = {
  location_label: "Pinned place",
  location_place_id: "place_123",
} as const;

void test("classifies strong when pin + country + admin_area_1 + postal_code", () => {
  const result = computeLocationQuality({
    ...PIN,
    country_code: "GB",
    admin_area_1: "England",
    admin_area_2: "Staffordshire",
    postal_code: "ST6 3EG",
    city: "Stoke-on-Trent",
  });

  assert.equal(result.quality, "strong");
  assert.deepEqual(result.missing, []);
});

void test("classifies medium when pin + country + admin_area_1 only (NG)", () => {
  const result = computeLocationQuality({
    ...PIN,
    country_code: "NG",
    admin_area_1: "Lagos",
    city: "Ikoyi",
  });

  assert.equal(result.quality, "medium");
  assert.deepEqual(result.missing, [
    "Add a county/district/LGA (optional but helpful).",
    "Add a postal code (optional but improves matching).",
  ]);
});

void test("classifies weak when no pin present", () => {
  const result = computeLocationQuality({
    country_code: "US",
    admin_area_1: "California",
    postal_code: "94105",
  });

  assert.equal(result.quality, "weak");
  assert.ok(result.missing.includes("Pin an area using “Search for an area”."));
});

void test("classifies weak when pin missing admin_area_1 and city", () => {
  const result = computeLocationQuality({
    ...PIN,
    country_code: "US",
  });

  assert.equal(result.quality, "weak");
  assert.deepEqual(result.missing, [
    "Add a state/region (e.g., Lagos, California, Ontario).",
    "Add a county/district/LGA (optional but helpful).",
    "Add a postal code (optional but improves matching).",
  ]);
});
