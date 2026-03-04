import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createScrollIdleController,
  DEFAULT_SCROLL_IDLE_MS,
  resolveScrollIdleActive,
} from "@/lib/ui/useScrollIdle";

void test("useScrollIdle exports expected default idle threshold", () => {
  assert.equal(DEFAULT_SCROLL_IDLE_MS, 140);
});

void test("useScrollIdle resolver reports active scrolling only within idle window", () => {
  assert.equal(
    resolveScrollIdleActive({
      lastActivityAtMs: 100,
      nowMs: 220,
      idleMs: 140,
    }),
    true
  );
  assert.equal(
    resolveScrollIdleActive({
      lastActivityAtMs: 100,
      nowMs: 241,
      idleMs: 140,
    }),
    false
  );
  assert.equal(
    resolveScrollIdleActive({
      lastActivityAtMs: null,
      nowMs: 241,
      idleMs: 140,
    }),
    false
  );
});

void test("useScrollIdle controller toggles scrolling state with fake timers", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const changes: boolean[] = [];
  const controller = createScrollIdleController({
    idleMs: 140,
    onChange: (next) => {
      changes.push(next);
    },
  });

  controller.markActivity();
  assert.equal(controller.isScrolling(), true);
  assert.deepEqual(changes, [true]);

  t.mock.timers.tick(80);
  controller.markActivity();
  assert.equal(controller.isScrolling(), true);
  assert.deepEqual(changes, [true]);

  t.mock.timers.tick(139);
  assert.equal(controller.isScrolling(), true);

  t.mock.timers.tick(1);
  assert.equal(controller.isScrolling(), false);
  assert.deepEqual(changes, [true, false]);
});

void test("useScrollIdle source uses passive scroll listener and rAF throttling", () => {
  const sourcePath = path.join(process.cwd(), "lib", "ui", "useScrollIdle.ts");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /window\.addEventListener\("scroll", onScroll, \{ passive: true \}\)/);
  assert.match(source, /rafRef\.current = window\.requestAnimationFrame\(\(\) => \{/);
  assert.match(source, /window\.cancelAnimationFrame\(rafRef\.current\)/);
});
