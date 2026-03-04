import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const supportWidgetPath = path.join(process.cwd(), "components", "support", "SupportWidget.tsx");
const shortletsShellPath = path.join(process.cwd(), "components", "shortlets", "search", "ShortletsSearchShell.tsx");
const floatingActionRailPath = path.join(process.cwd(), "components", "ui", "FloatingActionRail.tsx");

void test("shared floating action rail exposes safe-zone and focus-aware helpers", () => {
  const source = fs.readFileSync(floatingActionRailPath, "utf8");

  assert.ok(source.includes("FLOATING_ACTION_RAIL_BASE_BOTTOM_OFFSET_PX"));
  assert.ok(source.includes("resolveFloatingActionRailVisibility"));
  assert.ok(source.includes('document.addEventListener("focusin"'));
  assert.ok(source.includes('document.addEventListener("focusout"'));
  assert.ok(source.includes("pointer-events-none invisible opacity-0"));
  assert.ok(source.includes("pointer-events-auto visible opacity-100"));
  assert.ok(source.includes("env(safe-area-inset-bottom, 0px)"));
});

void test("support widget uses shared floating rail with shortlets/home avoid selectors", () => {
  const source = fs.readFileSync(supportWidgetPath, "utf8");

  assert.ok(source.includes("FloatingActionRail"));
  assert.ok(source.includes("hideWhenFormFocused={!open && !isShortletsRoute}"));
  assert.ok(source.includes("baseBottomOffsetPx={railBaseBottomOffset}"));
  assert.ok(source.includes("shortlets-open-map"));
  assert.ok(source.includes("mobile-quickstart-search-trigger"));
  assert.ok(source.includes("mobile-quicksearch-location-input"));
});

void test("shortlets mobile map CTA uses shared floating rail and keeps map modal controls", () => {
  const source = fs.readFileSync(shortletsShellPath, "utf8");

  assert.ok(source.includes("FloatingActionRail"));
  assert.ok(source.includes("shortlets-expanded-search-controls"));
  assert.ok(source.includes("shortlets-compact-search-pill"));
  assert.ok(source.includes('data-testid="shortlets-open-map"'));
  assert.ok(source.includes("aria-controls=\"shortlets-mobile-map-modal\""));
});
