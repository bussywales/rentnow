import test from "node:test";
import assert from "node:assert/strict";
import { shouldRenderImageCountBadge } from "@/components/properties/PropertyImageCarousel";

void test("property image carousel renders count badge for multiple images", () => {
  assert.equal(shouldRenderImageCountBadge(2), true);
  assert.equal(shouldRenderImageCountBadge(24), true);
});

void test("property image carousel hides count badge for a single image", () => {
  assert.equal(shouldRenderImageCountBadge(1), false);
  assert.equal(shouldRenderImageCountBadge(0), false);
});
