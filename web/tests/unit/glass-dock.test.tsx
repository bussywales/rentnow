import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveGlassDockCollapsedState } from "@/components/layout/GlassDock";

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
  assert.match(source, /data-testid="glass-dock-search-trigger"/);
  assert.match(source, /GlassDockSearchOverlay/);
  assert.match(source, /setSearchOpen\(\(current\) => !current\)/);
  assert.match(source, /style=\{\{ paddingBottom: "calc\(env\(safe-area-inset-bottom, 0px\) \+ 0.4rem\)" \}\}/);
  assert.match(source, /data-scrolling=\{isScrolling \? "true" : "false"\}/);
  assert.match(source, /isScrolling[\s\S]*\? "shadow-\[inset_0_1px_0_rgba\(255,255,255,0.3\),0_14px_32px_rgba\(15,23,42,0.16\)\]"/);
  assert.match(source, /: "backdrop-blur-xl backdrop-saturate-150 shadow-\[inset_0_1px_0_rgba\(255,255,255,0.3\),0_14px_32px_rgba\(15,23,42,0.16\)\]"/);
});

void test("glass dock search overlay source supports open-close and command actions", () => {
  const sourcePath = path.join(process.cwd(), "components", "layout", "GlassDockSearchOverlay.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="glass-dock-search-overlay"/);
  assert.match(source, /data-testid="glass-dock-search-input"/);
  assert.match(source, /data-testid="glass-dock-search-close"/);
  assert.match(source, /data-testid="glass-dock-search-near-me"/);
  assert.match(source, /data-testid="glass-dock-search-reset"/);
  assert.match(source, /data-testid="glass-dock-search-submit"/);
  assert.match(source, /if \(event.key !== "Escape"\) return;/);
});
