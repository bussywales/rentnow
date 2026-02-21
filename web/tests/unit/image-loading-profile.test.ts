import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveFetchPriority,
  resolveImageLoading,
  resolveImageLoadingProfile,
  shouldPriorityImage,
} from "@/lib/images/loading-profile";

void test("shortlets list prioritises only first three desktop cards and first two mobile cards", () => {
  assert.equal(
    shouldPriorityImage({ surface: "shortlets_list", viewport: "desktop", index: 0, slideIndex: 0 }),
    true
  );
  assert.equal(
    shouldPriorityImage({ surface: "shortlets_list", viewport: "desktop", index: 2, slideIndex: 0 }),
    true
  );
  assert.equal(
    shouldPriorityImage({ surface: "shortlets_list", viewport: "desktop", index: 3, slideIndex: 0 }),
    false
  );

  assert.equal(
    shouldPriorityImage({ surface: "shortlets_list", viewport: "mobile", index: 0, slideIndex: 0 }),
    true
  );
  assert.equal(
    shouldPriorityImage({ surface: "shortlets_list", viewport: "mobile", index: 1, slideIndex: 0 }),
    true
  );
  assert.equal(
    shouldPriorityImage({ surface: "shortlets_list", viewport: "mobile", index: 2, slideIndex: 0 }),
    false
  );
});

void test("properties list follows same above-the-fold caps and only first slide can be eager", () => {
  assert.equal(
    shouldPriorityImage({ surface: "properties_list", viewport: "desktop", index: 1, slideIndex: 0 }),
    true
  );
  assert.equal(
    shouldPriorityImage({ surface: "properties_list", viewport: "desktop", index: 3, slideIndex: 0 }),
    false
  );
  assert.equal(
    shouldPriorityImage({ surface: "properties_list", viewport: "mobile", index: 2, slideIndex: 0 }),
    false
  );
  assert.equal(
    shouldPriorityImage({ surface: "properties_list", viewport: "desktop", index: 0, slideIndex: 1 }),
    false
  );
});

void test("property detail gallery only prioritises the first image", () => {
  assert.equal(
    shouldPriorityImage({ surface: "property_gallery", index: 0, slideIndex: 0 }),
    true
  );
  assert.equal(
    shouldPriorityImage({ surface: "property_gallery", index: 0, slideIndex: 1 }),
    false
  );
  assert.equal(
    shouldPriorityImage({ surface: "property_gallery", index: 1, slideIndex: 0 }),
    false
  );
});

void test("loading profile helpers map priority state consistently", () => {
  assert.equal(resolveImageLoading(true), "eager");
  assert.equal(resolveImageLoading(false), "lazy");
  assert.equal(resolveFetchPriority(true), "high");
  assert.equal(resolveFetchPriority(false), "auto");
  assert.deepEqual(resolveImageLoadingProfile(true), {
    priority: true,
    loading: "eager",
    fetchPriority: "high",
  });
  assert.deepEqual(resolveImageLoadingProfile(false), {
    priority: false,
    loading: "lazy",
    fetchPriority: "auto",
  });
});
