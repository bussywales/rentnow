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
