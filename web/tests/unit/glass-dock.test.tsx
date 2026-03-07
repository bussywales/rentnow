import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createGlassDockTapFeedbackController,
  GLASS_DOCK_NAVIGATION_LOADING_DELAY_MS,
  GLASS_DOCK_OPTIMISTIC_ACTIVE_MS,
  resolveGlassDockCollapsedState,
  resolveGlassDockRouteActiveState,
} from "@/components/layout/GlassDock";

void test("glass dock collapse resolver follows scroll direction hysteresis and search-open override", () => {
  assert.equal(
    resolveGlassDockCollapsedState({
      direction: "down",
      isNearBottomNavSafeZone: false,
      searchOpen: false,
    }),
    true
  );
  assert.equal(
    resolveGlassDockCollapsedState({
      direction: "up",
      isNearBottomNavSafeZone: false,
      searchOpen: false,
    }),
    false
  );
  assert.equal(
    resolveGlassDockCollapsedState({
      direction: "idle",
      isNearBottomNavSafeZone: true,
      searchOpen: false,
    }),
    false
  );
  assert.equal(
    resolveGlassDockCollapsedState({
      direction: "down",
      isNearBottomNavSafeZone: false,
      searchOpen: true,
    }),
    false
  );
});

void test("glass dock source declares mobile dock shell, route gating, and search overlay controls", () => {
  const sourcePath = path.join(process.cwd(), "components", "layout", "GlassDock.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /const HIDE_PREFIXES = \["\/admin", "\/auth"\]/);
  assert.match(source, /useScrollIdle\(\{ idleMs: 140 \}\)/);
  assert.match(source, /data-testid="glass-dock"/);
  assert.match(source, /fixed bottom-0 left-3 right-3/);
  assert.match(source, /data-testid="glass-dock-search-trigger"/);
  assert.match(source, /GlassDockSearchOverlay/);
  assert.match(source, /setSearchOpen\(\(current\) => !current\)/);
  assert.match(source, /style=\{\{ paddingBottom: "calc\(env\(safe-area-inset-bottom, 0px\) \+ 0.4rem\)" \}\}/);
  assert.match(source, /data-scrolling=\{isScrolling \? "true" : "false"\}/);
  assert.match(source, /isScrolling[\s\S]*\? "shadow-\[inset_0_1px_0_rgba\(255,255,255,0.3\),0_14px_32px_rgba\(15,23,42,0.16\)\]"/);
  assert.match(source, /: "backdrop-blur-xl backdrop-saturate-150 shadow-\[inset_0_1px_0_rgba\(255,255,255,0.3\),0_14px_32px_rgba\(15,23,42,0.16\)\]"/);
  assert.match(source, /min-h-11 min-w-11/);
  assert.match(source, /pointer-events-auto/);
  assert.match(source, /active:scale-\[0\.97\] active:opacity-80/);
  assert.match(source, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(source, /data-testid=\{`glass-dock-loading-\$\{route\.id\}`\}/);
});

void test("glass dock search overlay source supports open-close and command actions", () => {
  const sourcePath = path.join(process.cwd(), "components", "layout", "GlassDockSearchOverlay.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="glass-dock-search-overlay"/);
  assert.match(source, /id="glass-dock-search-overlay"/);
  assert.match(source, /fixed bottom-\[calc\(5rem\+env\(safe-area-inset-bottom\)\)\] left-3 right-3/);
  assert.match(source, /data-testid="glass-dock-search-input"/);
  assert.match(source, /data-testid="glass-dock-search-close"/);
  assert.match(source, /data-testid="glass-dock-search-near-me"/);
  assert.match(source, /data-testid="glass-dock-search-reset"/);
  assert.match(source, /data-testid="glass-dock-search-submit"/);
  assert.match(source, /if \(event.key !== "Escape"\) return;/);
});

void test("glass dock route active resolver honors optimistic active key immediately", () => {
  assert.equal(
    resolveGlassDockRouteActiveState({
      pathname: "/",
      href: "/explore-v2",
      routeId: "explore",
      optimisticActiveRouteId: "explore",
    }),
    true
  );
  assert.equal(
    resolveGlassDockRouteActiveState({
      pathname: "/",
      href: "/explore-v2",
      routeId: "explore",
      optimisticActiveRouteId: null,
    }),
    false
  );
});

void test("glass dock tap feedback controller sets optimistic active immediately and clears on path settle", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "clearTimeout"] });

  let optimisticActiveRouteId: string | null = null;
  let pendingRouteId: string | null = null;
  let loadingRouteId: string | null = null;

  const controller = createGlassDockTapFeedbackController({
    onOptimisticActiveRouteIdChange: (routeId) => {
      optimisticActiveRouteId = routeId;
    },
    onPendingRouteIdChange: (routeId) => {
      pendingRouteId = routeId;
    },
    onLoadingRouteIdChange: (routeId) => {
      loadingRouteId = routeId;
    },
  });

  controller.handleTap({ routeId: "explore", isAlreadyActive: false });
  assert.equal(optimisticActiveRouteId, "explore");
  assert.equal(pendingRouteId, "explore");
  assert.equal(loadingRouteId, null);

  t.mock.timers.tick(GLASS_DOCK_NAVIGATION_LOADING_DELAY_MS - 1);
  assert.equal(loadingRouteId, null);

  t.mock.timers.tick(1);
  assert.equal(loadingRouteId, "explore");

  controller.handlePathSettled();
  assert.equal(optimisticActiveRouteId, null);
  assert.equal(pendingRouteId, null);
  assert.equal(loadingRouteId, null);

  controller.handleTap({ routeId: "saved", isAlreadyActive: true });
  assert.equal(optimisticActiveRouteId, "saved");
  assert.equal(pendingRouteId, null);
  assert.equal(loadingRouteId, null);

  t.mock.timers.tick(GLASS_DOCK_OPTIMISTIC_ACTIVE_MS);
  assert.equal(optimisticActiveRouteId, null);
});
