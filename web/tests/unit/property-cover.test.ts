import test from "node:test";
import assert from "node:assert/strict";
import { coverBelongsToImages } from "@/lib/properties/cover";

void test("coverBelongsToImages rejects unknown url", () => {
  const urls = ["a.jpg", "b.jpg"];
  assert.equal(coverBelongsToImages("c.jpg", urls), false);
});

void test("coverBelongsToImages accepts null/empty", () => {
  const urls = ["a.jpg"];
  assert.equal(coverBelongsToImages(null, urls), true);
  assert.equal(coverBelongsToImages(undefined, urls), true);
});

void test("coverBelongsToImages accepts known url", () => {
  const urls = ["a.jpg", "b.jpg"];
  assert.equal(coverBelongsToImages("b.jpg", urls), true);
});
