import test from "node:test";
import assert from "node:assert/strict";
import { createVisibilityAwarePollController } from "@/lib/notifications/polling";

function createHarness() {
  let visible = true;
  const listeners = new Set<() => void>();
  const timers = new Map<number, () => void>();
  let nextTimerId = 1;

  return {
    setIntervalFn(callback: () => void) {
      const id = nextTimerId++;
      timers.set(id, callback);
      return id as ReturnType<typeof setInterval>;
    },
    clearIntervalFn(id: ReturnType<typeof setInterval>) {
      timers.delete(Number(id));
    },
    addVisibilityChangeListener(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isVisible() {
      return visible;
    },
    emitVisibility(nextVisible: boolean) {
      visible = nextVisible;
      for (const listener of listeners) listener();
    },
    tick() {
      for (const callback of [...timers.values()]) callback();
    },
    timerCount() {
      return timers.size;
    },
  };
}

void test("does not poll while disabled", () => {
  const harness = createHarness();
  let ticks = 0;

  const controller = createVisibilityAwarePollController({
    intervalMs: 1_000,
    onTick: () => {
      ticks += 1;
    },
    isVisible: harness.isVisible,
    addVisibilityChangeListener: harness.addVisibilityChangeListener,
    setIntervalFn: harness.setIntervalFn,
    clearIntervalFn: harness.clearIntervalFn,
  });

  controller.start();
  harness.tick();

  assert.equal(harness.timerCount(), 0);
  assert.equal(ticks, 0);
});

void test("polls on interval while enabled and visible", () => {
  const harness = createHarness();
  let ticks = 0;

  const controller = createVisibilityAwarePollController({
    intervalMs: 1_000,
    onTick: () => {
      ticks += 1;
    },
    isVisible: harness.isVisible,
    addVisibilityChangeListener: harness.addVisibilityChangeListener,
    setIntervalFn: harness.setIntervalFn,
    clearIntervalFn: harness.clearIntervalFn,
  });

  controller.start();
  controller.setEnabled(true);
  assert.equal(harness.timerCount(), 1);

  harness.tick();
  harness.tick();

  assert.equal(ticks, 2);
});

void test("stops polling when tab becomes hidden", () => {
  const harness = createHarness();
  let ticks = 0;

  const controller = createVisibilityAwarePollController({
    intervalMs: 1_000,
    onTick: () => {
      ticks += 1;
    },
    isVisible: harness.isVisible,
    addVisibilityChangeListener: harness.addVisibilityChangeListener,
    setIntervalFn: harness.setIntervalFn,
    clearIntervalFn: harness.clearIntervalFn,
  });

  controller.start();
  controller.setEnabled(true);
  harness.tick();
  assert.equal(ticks, 1);

  harness.emitVisibility(false);
  assert.equal(harness.timerCount(), 0);

  harness.tick();
  assert.equal(ticks, 1);
});

void test("refreshes once when tab becomes visible and then resumes interval", () => {
  const harness = createHarness();
  let ticks = 0;

  const controller = createVisibilityAwarePollController({
    intervalMs: 1_000,
    onTick: () => {
      ticks += 1;
    },
    isVisible: harness.isVisible,
    addVisibilityChangeListener: harness.addVisibilityChangeListener,
    setIntervalFn: harness.setIntervalFn,
    clearIntervalFn: harness.clearIntervalFn,
  });

  controller.start();
  controller.setEnabled(true);
  harness.emitVisibility(false);
  assert.equal(harness.timerCount(), 0);

  harness.emitVisibility(true);
  assert.equal(ticks, 1);
  assert.equal(harness.timerCount(), 1);

  harness.tick();
  assert.equal(ticks, 2);
});

void test("does not refresh on visible change when disabled", () => {
  const harness = createHarness();
  let ticks = 0;

  const controller = createVisibilityAwarePollController({
    intervalMs: 1_000,
    onTick: () => {
      ticks += 1;
    },
    isVisible: harness.isVisible,
    addVisibilityChangeListener: harness.addVisibilityChangeListener,
    setIntervalFn: harness.setIntervalFn,
    clearIntervalFn: harness.clearIntervalFn,
  });

  controller.start();
  controller.setEnabled(false);
  harness.emitVisibility(false);
  harness.emitVisibility(true);

  assert.equal(harness.timerCount(), 0);
  assert.equal(ticks, 0);
});
