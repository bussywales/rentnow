import test from "node:test";
import assert from "node:assert/strict";
import {
  reduceExploreV2HeroLoadState,
  resolveExploreV2HeroRenderState,
} from "@/components/explore-v2/ExploreV2Card";

void test("explore-v2 hero placeholder remains persistent while image is loading", () => {
  const renderState = resolveExploreV2HeroRenderState({
    heroImageUrl: "https://example.supabase.co/storage/v1/object/public/images/hero.jpg",
    loadState: "loading",
  });

  assert.equal(renderState.placeholderPersistent, true);
  assert.equal(renderState.shouldRenderImage, true);
  assert.equal(renderState.imageOpacityClass, "opacity-0");
  assert.equal(renderState.showUnavailableBadge, false);
});

void test("explore-v2 hero fade class switches to visible after load event", () => {
  const nextState = reduceExploreV2HeroLoadState("loading", "load");
  const renderState = resolveExploreV2HeroRenderState({
    heroImageUrl: "https://example.supabase.co/storage/v1/object/public/images/hero.jpg",
    loadState: nextState,
  });

  assert.equal(nextState, "loaded");
  assert.equal(renderState.imageOpacityClass, "opacity-100");
  assert.equal(renderState.showUnavailableBadge, false);
});

void test("explore-v2 hero error keeps placeholder and marks unavailable", () => {
  const nextState = reduceExploreV2HeroLoadState("loading", "error");
  const renderState = resolveExploreV2HeroRenderState({
    heroImageUrl: "https://example.supabase.co/storage/v1/object/public/images/hero.jpg",
    loadState: nextState,
  });

  assert.equal(nextState, "error");
  assert.equal(renderState.placeholderPersistent, true);
  assert.equal(renderState.shouldRenderImage, false);
  assert.equal(renderState.showUnavailableBadge, true);
});
