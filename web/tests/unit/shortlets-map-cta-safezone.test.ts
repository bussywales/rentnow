import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const supportWidgetPath = path.join(process.cwd(), "components", "support", "SupportWidget.tsx");
const shortletsShellPath = path.join(process.cwd(), "components", "shortlets", "search", "ShortletsSearchShell.tsx");

void test("support widget applies a shortlets mobile safe-zone offset", () => {
  const source = fs.readFileSync(supportWidgetPath, "utf8");

  assert.ok(source.includes('pathname?.startsWith("/shortlets")'));
  assert.ok(source.includes("bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4"));
  assert.ok(source.includes("bottom-4 right-4 sm:bottom-6 sm:right-6"));
});

void test("shortlets mobile map CTA remains fixed in bottom-right tap zone", () => {
  const source = fs.readFileSync(shortletsShellPath, "utf8");

  assert.ok(source.includes('data-testid="shortlets-open-map"'));
  assert.ok(source.includes("fixed bottom-4 right-4 z-20"));
  assert.ok(source.includes("aria-controls=\"shortlets-mobile-map-modal\""));
});
