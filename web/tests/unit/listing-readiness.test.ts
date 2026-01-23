import test from "node:test";
import assert from "node:assert/strict";
import { computeListingReadiness } from "@/lib/properties/listing-readiness";

const baseListing = {
  id: "id",
  owner_id: "owner",
  title: "Title",
  city: "Lagos",
  rental_type: "long_term",
  price: 1000,
  currency: "USD",
  bedrooms: 1,
  bathrooms: 1,
  furnished: false,
  cover_image_url: null as string | null,
  images: [] as Array<{
    id: string;
    image_url: string;
    width?: number | null;
    height?: number | null;
  }>,
  country_code: "NG" as const,
};

void test("excellent listing gets high score and no major issues", () => {
  const result = computeListingReadiness({
    ...baseListing,
    cover_image_url: "cover.jpg",
    images: [
      { id: "1", image_url: "cover.jpg", width: 2000, height: 1200 },
      { id: "2", image_url: "a.jpg" },
      { id: "3", image_url: "b.jpg" },
      { id: "4", image_url: "c.jpg" },
      { id: "5", image_url: "d.jpg" },
      { id: "6", image_url: "e.jpg" },
      { id: "7", image_url: "f.jpg" },
      { id: "8", image_url: "g.jpg" },
    ],
    location_label: "Lagos",
    location_place_id: "place",
    admin_area_1: "Lagos",
    postal_code: "101233",
    latitude: 1,
    longitude: 1,
  });
  assert.ok(result.score >= 85);
  assert.equal(result.tier, "Excellent");
  assert.equal(result.issues.length, 0);
});

void test("weak location and no photos surface issues and low score", () => {
  const result = computeListingReadiness({
    ...baseListing,
    images: [],
    cover_image_url: null,
    latitude: null,
    longitude: null,
    location_label: null,
    admin_area_1: null,
  });
  assert.equal(result.tier, "Needs work");
  const labels = result.issues.map((i) => i.label).join(" ");
  assert.ok(labels.toLowerCase().includes("photos"));
  assert.ok(labels.toLowerCase().includes("location"));
  assert.ok(result.issues[0].code === "NO_PHOTOS" || result.issues[0].code === "LOCATION_WEAK");
});

void test("medium location and low photos drop to good/needs work with ordered issues", () => {
  const result = computeListingReadiness({
    ...baseListing,
    images: [
      { id: "1", image_url: "cover.jpg", width: 800, height: 1600 },
      { id: "2", image_url: "a.jpg" },
      { id: "3", image_url: "b.jpg" },
    ],
    cover_image_url: "cover.jpg",
    location_label: "Ikeja",
    location_place_id: "place",
    admin_area_1: "Lagos",
    country_code: "NG",
    latitude: 1,
    longitude: 1,
  });
  assert.ok(result.score < 85);
  assert.ok(result.issues.length > 0);
  assert.ok(result.issues[0].action === "photos" || result.issues[0].action === "location");
  assert.ok(
    result.issues[0].code === "LOW_PHOTO_COUNT" ||
      result.issues[0].code === "WEAK_COVER" ||
      result.issues[0].code === "LOCATION_MEDIUM"
  );
});

void test("photo_count and has_cover prevent false missing-photo issues", () => {
  const result = computeListingReadiness({
    ...baseListing,
    images: [],
    photo_count: 6,
    has_cover: true,
    cover_image_url: "cover.jpg",
    location_label: "Lagos",
    location_place_id: "pid",
    admin_area_1: "Lagos",
    country_code: "NG",
    latitude: 1,
    longitude: 1,
  });
  const codes = result.issues.map((i) => i.code);
  assert.ok(!codes.includes("NO_PHOTOS"));
  assert.ok(!codes.includes("NO_COVER"));
});
