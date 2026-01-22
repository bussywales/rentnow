import test from "node:test";
import assert from "node:assert/strict";
import { SaveStatusManager } from "@/lib/properties/save-status";

class FakeScheduler {
  now = 0;
  tasks: Array<{ time: number; fn: () => void }> = [];

  schedule(fn: () => void, ms: number) {
    const task = { time: this.now + ms, fn };
    this.tasks.push(task);
    return task;
  }

  clear(id: unknown) {
    this.tasks = this.tasks.filter((task) => task !== id);
  }

  advance(ms: number) {
    this.now += ms;
    const due = this.tasks.filter((task) => task.time <= this.now);
    this.tasks = this.tasks.filter((task) => task.time > this.now);
    due.sort((a, b) => a.time - b.time).forEach((task) => task.fn());
  }
}

void test("saving transitions to saved and back to idle with debounce and hold", () => {
  const scheduler = new FakeScheduler();
  const states: string[] = [];
  const manager = new SaveStatusManager((state) => states.push(state), scheduler);

  manager.setSaving();
  assert.equal(manager.current, "idle");
  scheduler.advance(299);
  assert.equal(manager.current, "idle");
  scheduler.advance(1);
  assert.equal(manager.current, "saving");

  manager.setSaved();
  assert.equal(manager.current, "saved");
  scheduler.advance(1499);
  assert.equal(manager.current, "saved");
  scheduler.advance(1);
  assert.equal(manager.current, "idle");
  assert.ok(states.includes("saving"));
  assert.ok(states.includes("saved"));
});

void test("error retains retry and allows retry to reschedule saving", () => {
  const scheduler = new FakeScheduler();
  const manager = new SaveStatusManager(() => undefined, scheduler);

  manager.setSaving();
  scheduler.advance(300);
  assert.equal(manager.current, "saving");
  manager.setError(() => manager.setSaving());
  assert.equal(manager.current, "error");
  assert.ok(manager.retry);

  manager.triggerRetry();
  scheduler.advance(300);
  assert.equal(manager.current, "saving");
});

void test("submitting transitions to submitted then idle", () => {
  const scheduler = new FakeScheduler();
  const manager = new SaveStatusManager(() => undefined, scheduler);

  manager.setSubmitting();
  assert.equal(manager.current, "submitting");
  manager.setSubmitted();
  assert.equal(manager.current, "submitted");
  scheduler.advance(1500);
  assert.equal(manager.current, "idle");
});
