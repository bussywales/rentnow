import test from "node:test";
import assert from "node:assert/strict";
import {
  computeDashboardListings,
  filterListings,
  resumeSetupHref,
  sortListings,
} from "@/lib/properties/host-dashboard";

const baseProperty = {
  id: "",
  owner_id: "owner",
  title: "Title",
  city: "City",
  rental_type: "long_term" as const,
  price: 1000,
  currency: "USD",
  bedrooms: 1,
  bathrooms: 1,
  furnished: false,
  images: [],
};

void test("sorts lowest readiness score first with tie-breakers", () => {
  const listings = computeDashboardListings([
    { ...baseProperty, id: "b", title: "B", updated_at: "2024-01-02" },
    { ...baseProperty, id: "a", title: "A", updated_at: "2024-01-03", images: [{ id: "1", image_url: "1" }] },
  ]);
  const sorted = sortListings(listings);
  assert.equal(sorted[0].id, "b");
});

void test("needs attention filter captures non-excellent or low score", () => {
  const listings = computeDashboardListings([
    { ...baseProperty, id: "weak", images: [] },
    { ...baseProperty, id: "ready", images: Array(5).fill(0).map((_, i) => ({ id: String(i), image_url: String(i) })), cover_image_url: "0", location_label: "Pin", location_place_id: "p", admin_area_1: "State", latitude: 1, longitude: 1 },
  ]);
  const needs = filterListings(listings, "needs_attention");
  assert.ok(needs.some((l) => l.id === "weak"));
});

void test("ready filter requires strong location, score >=90, no issues", () => {
  const listings = computeDashboardListings([
    { ...baseProperty, id: "almost", images: [{ id: "1", image_url: "1" }], cover_image_url: "1" },
    {
      ...baseProperty,
      id: "ready",
      images: Array(6).fill(0).map((_, i) => ({ id: String(i), image_url: String(i), width: 2000, height: 1200 })),
      cover_image_url: "0",
      location_label: "Pin",
      location_place_id: "p",
      admin_area_1: "State",
      country_code: "US",
      postal_code: "12345",
      latitude: 1,
      longitude: 1,
    },
  ]);
  const ready = filterListings(listings, "ready");
  assert.equal(ready.length, 1);
  assert.equal(ready[0].id, "ready");
});

void test("drafts filter matches draft status", () => {
  const listings = computeDashboardListings([
    { ...baseProperty, id: "draft", status: "draft" },
    { ...baseProperty, id: "live", status: "live" },
  ]);
  const drafts = filterListings(listings, "drafts");
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].id, "draft");
});

void test("resume setup href maps top issue codes", () => {
  assert.equal(resumeSetupHref("id", "LOCATION_WEAK"), "/dashboard/properties/id?focus=location");
  assert.equal(resumeSetupHref("id", "NO_PHOTOS"), "/dashboard/properties/id?step=photos");
});
