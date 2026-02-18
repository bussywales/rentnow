import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("shortlet widget renders popover and mobile sheet calendar containers", () => {
  const filePath = path.join(process.cwd(), "components", "properties", "ShortletBookingWidget.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes('data-testid="shortlet-calendar-overlay"'));
  assert.ok(contents.includes('"shortlet-calendar-popover"'));
  assert.ok(contents.includes('"shortlet-calendar-sheet"'));
});

void test("shortlet widget calendar actions are apply and clear", () => {
  const filePath = path.join(process.cwd(), "components", "properties", "ShortletBookingWidget.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("Apply dates"));
  assert.ok(contents.includes("Clear"));
  assert.equal(contents.includes("Hide calendar"), false);
});

void test("shortlet widget calendar popup exposes dialog semantics and close control", () => {
  const filePath = path.join(process.cwd(), "components", "properties", "ShortletBookingWidget.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes('role="dialog"'));
  assert.ok(contents.includes('aria-modal="true"'));
  assert.ok(contents.includes('aria-label="Close calendar"'));
});

void test("shortlet widget defines separate availability modifiers for past, booked and blocked", () => {
  const filePath = path.join(process.cwd(), "components", "properties", "ShortletBookingWidget.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("past: (date: Date) => toDateKey(date) < todayDateKey"));
  assert.ok(contents.includes("booked: (date: Date) => unavailableBySource.booked.has(toDateKey(date))"));
  assert.ok(contents.includes("blocked: (date: Date) => unavailableBySource.blocked.has(toDateKey(date))"));
});

void test("shortlet widget prevents selection of unavailable days at daypicker level", () => {
  const filePath = path.join(process.cwd(), "components", "properties", "ShortletBookingWidget.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("disabled={isUnavailableDate}"));
  assert.ok(contents.includes("excludeDisabled"));
  assert.ok(contents.includes("if (modifiers.disabled)"));
});

void test("shortlet widget legend explains available, selected, booked, blocked and past states", () => {
  const filePath = path.join(process.cwd(), "components", "properties", "ShortletBookingWidget.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("Available"));
  assert.ok(contents.includes("Selected"));
  assert.ok(contents.includes("Booked"));
  assert.ok(contents.includes("Blocked"));
  assert.ok(contents.includes("Past"));
});
