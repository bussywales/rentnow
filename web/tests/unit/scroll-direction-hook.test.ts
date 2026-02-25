import test from "node:test";
import assert from "node:assert/strict";
import { resolveShortletsStickyCollapsedState } from "@/components/shortlets/search/useShortletsStickyCollapse";

void test("near top always keeps sticky controls expanded", () => {
  const collapsed = resolveShortletsStickyCollapsedState({
    scrollY: 24,
    previousScrollY: 16,
    currentlyCollapsed: true,
    isMobileViewport: true,
    lockExpanded: false,
    nearTopPx: 40,
    collapseAfterPx: 200,
    expandBeforePx: 120,
    directionThresholdPx: 12,
  });

  assert.equal(collapsed, false);
});

void test("scrolling down beyond threshold collapses sticky controls", () => {
  const collapsed = resolveShortletsStickyCollapsedState({
    scrollY: 260,
    previousScrollY: 220,
    currentlyCollapsed: false,
    isMobileViewport: true,
    lockExpanded: false,
    nearTopPx: 40,
    collapseAfterPx: 200,
    expandBeforePx: 120,
    directionThresholdPx: 12,
  });

  assert.equal(collapsed, true);
});

void test("scrolling up expands sticky controls", () => {
  const collapsed = resolveShortletsStickyCollapsedState({
    scrollY: 280,
    previousScrollY: 320,
    currentlyCollapsed: true,
    isMobileViewport: true,
    lockExpanded: false,
    nearTopPx: 40,
    collapseAfterPx: 200,
    expandBeforePx: 120,
    directionThresholdPx: 12,
  });

  assert.equal(collapsed, false);
});

void test("non-mobile viewport never collapses sticky controls", () => {
  const collapsed = resolveShortletsStickyCollapsedState({
    scrollY: 420,
    previousScrollY: 360,
    currentlyCollapsed: true,
    isMobileViewport: false,
    lockExpanded: false,
    nearTopPx: 40,
    collapseAfterPx: 200,
    expandBeforePx: 120,
    directionThresholdPx: 12,
  });

  assert.equal(collapsed, false);
});

void test("lockExpanded keeps controls expanded even when scrolling down", () => {
  const collapsed = resolveShortletsStickyCollapsedState({
    scrollY: 500,
    previousScrollY: 420,
    currentlyCollapsed: true,
    isMobileViewport: true,
    lockExpanded: true,
    nearTopPx: 40,
    collapseAfterPx: 200,
    expandBeforePx: 120,
    directionThresholdPx: 12,
  });

  assert.equal(collapsed, false);
});
