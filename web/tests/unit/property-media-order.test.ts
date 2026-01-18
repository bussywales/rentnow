import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderedImages } from "@/lib/properties/order";

void test("buildOrderedImages orders images and sets positions", () => {
  const existing = [
    { id: "1", image_url: "a.jpg" },
    { id: "2", image_url: "b.jpg" },
    { id: "3", image_url: "c.jpg" },
  ];
  const { updates, ordered } = buildOrderedImages(existing, ["c.jpg", "a.jpg", "b.jpg"]);
  assert.equal(updates[0].id, "3");
  assert.equal(updates[0].position, 0);
  assert.equal(ordered[0].image_url, "c.jpg");
});

void test("buildOrderedImages rejects missing or unknown images", () => {
  const existing = [
    { id: "1", image_url: "a.jpg" },
    { id: "2", image_url: "b.jpg" },
  ];
  assert.throws(
    () => buildOrderedImages(existing, ["a.jpg"]),
    /include all images/i,
    "should require full list"
  );
  assert.throws(
    () => buildOrderedImages(existing, ["a.jpg", "z.jpg"]),
    /unknown image/i,
    "should block unknown image"
  );
  assert.throws(
    () => buildOrderedImages(existing, ["a.jpg", "a.jpg"]),
    /duplicate/i,
    "should block duplicates"
  );
});
