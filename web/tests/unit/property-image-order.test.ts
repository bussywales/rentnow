import test from "node:test";
import assert from "node:assert/strict";
import { orderImagesWithCover, getPrimaryImageUrl } from "@/lib/properties/images";

void test("orderImagesWithCover promotes cover to first without duplicates", () => {
  const images = [
    { id: "1", image_url: "a.jpg", position: 1 },
    { id: "2", image_url: "b.jpg", position: 0 },
    { id: "3", image_url: "c.jpg", position: 2 },
  ];
  const ordered = orderImagesWithCover("c.jpg", images);
  assert.equal(ordered[0].image_url, "c.jpg");
  assert.equal(ordered.length, 3);
  assert.deepEqual(
    ordered.slice(1).map((img) => img.image_url),
    ["b.jpg", "a.jpg"]
  );
});

void test("orderImagesWithCover falls back to position ordering when cover missing", () => {
  const images = [
    { id: "1", image_url: "a.jpg", position: 5 },
    { id: "2", image_url: "b.jpg", position: 1 },
  ];
  const ordered = orderImagesWithCover("x.jpg", images);
  assert.deepEqual(
    ordered.map((img) => img.image_url),
    ["b.jpg", "a.jpg"]
  );
});

void test("getPrimaryImageUrl returns cover when valid", () => {
  const property = {
    cover_image_url: "b.jpg",
    images: [
      { image_url: "a.jpg", position: 0 },
      { image_url: "b.jpg", position: 1 },
    ],
  } as unknown as Parameters<typeof getPrimaryImageUrl>[0];
  assert.equal(getPrimaryImageUrl(property), "b.jpg");
});
