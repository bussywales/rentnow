import test from "node:test";
import assert from "node:assert/strict";
import { pickRecommendedCover } from "@/lib/properties/recommended-cover";

void test("prefers landscape high-res over portrait", () => {
  const images = [
    { image_url: "portrait", width: 1200, height: 2000 },
    { image_url: "landscape", width: 2000, height: 1200 },
  ];
  const recommended = pickRecommendedCover(images);
  assert.equal(recommended.url, "landscape");
});

void test("chooses closest to 16:9 among similar res", () => {
  const images = [
    { image_url: "square", width: 1500, height: 1500 },
    { image_url: "near169", width: 1920, height: 1080 },
  ];
  const recommended = pickRecommendedCover(images);
  assert.equal(recommended.url, "near169");
});

void test("tie-breakers stable by position then created_at", () => {
  const images = [
    { image_url: "a", width: 1600, height: 900, position: 1, created_at: "2020-01-02" },
    { image_url: "b", width: 1600, height: 900, position: 0, created_at: "2020-01-01" },
  ];
  const recommended = pickRecommendedCover(images);
  assert.equal(recommended.url, "b");
});

void test("handles missing metadata gracefully", () => {
  const images = [
    { image_url: "no-meta" },
    { image_url: "also-no-meta" },
  ];
  const recommended = pickRecommendedCover(images, ["no-meta", "also-no-meta"]);
  assert.ok(recommended.url === "no-meta" || recommended.url === "also-no-meta");
});
