import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const bellPath = path.join(process.cwd(), "components", "notifications", "NotificationsBell.tsx");

void test("notifications bell exposes dialog accessibility semantics", () => {
  const contents = fs.readFileSync(bellPath, "utf8");

  assert.ok(contents.includes("aria-expanded={open}"));
  assert.ok(contents.includes("aria-controls={panelId}"));
  assert.ok(contents.includes('id={panelId}'));
  assert.ok(contents.includes('role="dialog"'));
  assert.ok(contents.includes('aria-label="Notifications"'));
  assert.ok(contents.includes("tabIndex={-1}"));
  assert.ok(contents.includes("panelRef.current?.focus()"));
});

void test("notifications bell supports escape close and focus restoration", () => {
  const contents = fs.readFileSync(bellPath, "utf8");

  assert.ok(contents.includes("if (event.key !== \"Escape\") return;"));
  assert.ok(contents.includes("event.preventDefault();"));
  assert.ok(contents.includes("closePanel();"));
  assert.ok(contents.includes("window.requestAnimationFrame(() => {"));
  assert.ok(contents.includes("bellButtonRef.current?.focus();"));
  assert.ok(contents.includes("closeOnOutside"));
});

void test("notifications polling is visibility-aware and tied to dropdown open state", () => {
  const contents = fs.readFileSync(bellPath, "utf8");

  assert.ok(contents.includes("createVisibilityAwarePollController"));
  assert.ok(contents.includes("pollControllerRef.current = controller;"));
  assert.ok(contents.includes("controller.start();"));
  assert.ok(contents.includes("controller.setEnabled(open);"));
  assert.ok(contents.includes("if (!open) return;"));
  assert.ok(contents.includes("void controller.triggerOnce().catch(() => undefined);"));
  assert.equal(contents.includes("window.setInterval"), false);
});
