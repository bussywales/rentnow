import test from "node:test";
import assert from "node:assert/strict";
import {
  computeListingCompleteness,
  hasMeaningfulListingTitle,
  normalizeListingTitleForDisplay,
  resolveListingCompletenessStatus,
  resolveListingHeroMediaPreference,
} from "@/lib/properties/listing-quality";

void test("listing completeness returns 100 for complete core listing fields", () => {
  const completeness = computeListingCompleteness({
    title: "Modern 2 Bed Apartment in Victoria Island",
    description: "Bright and spacious apartment with ensuite rooms, balcony, and secure parking.",
    cover_image_url: "https://images.example.com/cover.jpg",
    images: [
      { id: "img-1", image_url: "https://images.example.com/cover.jpg", position: 0 },
      { id: "img-2", image_url: "https://images.example.com/lounge.jpg", position: 1 },
      { id: "img-3", image_url: "https://images.example.com/bedroom.jpg", position: 2 },
    ],
    price: 2500,
    currency: "USD",
    city: "Lagos",
    has_video: true,
  });

  assert.equal(completeness.score, 100);
  assert.equal(completeness.has_title, true);
  assert.equal(completeness.has_meaningful_title, true);
  assert.equal(completeness.has_cover_image, true);
  assert.equal(completeness.has_min_images, true);
  assert.equal(completeness.has_description, true);
  assert.equal(completeness.has_price, true);
  assert.equal(completeness.has_location, true);
  assert.equal(completeness.has_video, true);
  assert.deepEqual(completeness.missingItems, []);
});

void test("listing completeness flags missing core fields and weak title quality", () => {
  const completeness = computeListingCompleteness({
    title: "LISTING",
    description: " ",
    images: [{ id: "img-1", image_url: "https://images.example.com/a.jpg", position: 1 }],
    cover_image_url: null,
    price: 0,
    currency: "",
    city: "",
    location_label: "",
  });

  assert.equal(completeness.has_title, true);
  assert.equal(completeness.has_meaningful_title, false);
  assert.equal(completeness.has_cover_image, false);
  assert.equal(completeness.has_min_images, false);
  assert.equal(completeness.has_description, false);
  assert.equal(completeness.has_price, false);
  assert.equal(completeness.has_location, false);
  assert.ok(completeness.score < 40);
  assert.ok(completeness.missingItems.some((item) => item.includes("specific title")));
  assert.ok(completeness.missingItems.some((item) => item.includes("cover image")));
  assert.ok(completeness.missingItems.some((item) => item.includes("at least 3 photos")));
  assert.ok(completeness.missingItems.some((item) => item.includes("description")));
  assert.ok(completeness.missingItems.some((item) => item.includes("price")));
  assert.ok(completeness.missingItems.some((item) => item.includes("location")));
});

void test("listing completeness supports admin fallback photo summary fields", () => {
  const completeness = computeListingCompleteness({
    title: "Modern two bed apartment in Lekki",
    description: "Well-finished apartment close to schools and transport links.",
    has_cover: true,
    photo_count: 4,
    price: 3500,
    currency: "USD",
    city: "Lagos",
    has_video: false,
  });

  assert.equal(completeness.has_cover_image, true);
  assert.equal(completeness.has_min_images, true);
  assert.equal(completeness.has_video, false);
  assert.equal(completeness.score, 100);
});

void test("listing completeness reports missing cover when only photo count is provided", () => {
  const completeness = computeListingCompleteness({
    title: "Spacious three bed in Ikeja",
    description: "Family-friendly home with parking and en-suite rooms.",
    photo_count: 3,
    has_cover: false,
    price: 1800,
    currency: "USD",
    city: "Lagos",
  });

  assert.equal(completeness.has_cover_image, false);
  assert.equal(completeness.has_min_images, true);
  assert.ok(completeness.missingFlags.includes("missing_cover"));
});

void test("hero media preference uses featured video only when video is valid", () => {
  const featuredVideo = resolveListingHeroMediaPreference({
    featured_media: "video",
    has_video: true,
    cover_image_url: "https://images.example.com/cover.jpg",
  });
  assert.equal(featuredVideo.mode, "video");
  assert.equal(featuredVideo.source, "featured_video");
  assert.equal(featuredVideo.imageUrl, "https://images.example.com/cover.jpg");

  const invalidVideo = resolveListingHeroMediaPreference({
    featured_media: "video",
    has_video: false,
    cover_image_url: "https://images.example.com/cover.jpg",
    images: [{ id: "img-1", image_url: "https://images.example.com/photo.jpg", position: 0 }],
  });
  assert.equal(invalidVideo.mode, "image");
  assert.equal(invalidVideo.source, "cover_image");
  assert.equal(invalidVideo.imageUrl, "https://images.example.com/cover.jpg");
});

void test("hero media preference falls back to first ordered image when no cover exists", () => {
  const preference = resolveListingHeroMediaPreference({
    featured_media: "image",
    images: [
      { id: "img-2", image_url: "https://images.example.com/second.jpg", position: 2 },
      { id: "img-1", image_url: "https://images.example.com/first.jpg", position: 0 },
    ],
  });
  assert.equal(preference.mode, "image");
  assert.equal(preference.source, "first_image");
  assert.equal(preference.imageUrl, "https://images.example.com/first.jpg");
});

void test("normalize listing title display reuses formatter behaviour", () => {
  assert.equal(
    normalizeListingTitleForDisplay("CCTV AND AC WITH WIFI"),
    "CCTV And AC With Wi-Fi"
  );
  assert.equal(hasMeaningfulListingTitle("CCTV AND AC WITH WIFI"), false);
  assert.equal(hasMeaningfulListingTitle("Luxury 2 Bed in Lekki"), true);
});

void test("listing completeness status thresholds map to strong/fair/needs work", () => {
  assert.equal(resolveListingCompletenessStatus(95), "Strong");
  assert.equal(resolveListingCompletenessStatus(85), "Strong");
  assert.equal(resolveListingCompletenessStatus(84), "Fair");
  assert.equal(resolveListingCompletenessStatus(60), "Fair");
  assert.equal(resolveListingCompletenessStatus(59), "Needs work");
});
