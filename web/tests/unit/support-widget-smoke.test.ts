import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("support widget is mounted globally in app layout", () => {
  const layoutPath = path.join(process.cwd(), "app", "layout.tsx");
  const source = fs.readFileSync(layoutPath, "utf8");

  assert.match(source, /SupportWidget/);
  assert.match(source, /<SupportWidget/);
  assert.match(source, /prefillEmail=\{supportPrefillEmail\}/);
});

void test("support widget exposes open, close, quick actions, and /support fallback", () => {
  const widgetPath = path.join(process.cwd(), "components", "support", "SupportWidget.tsx");
  const source = fs.readFileSync(widgetPath, "utf8");

  assert.match(source, /data-testid="support-widget-button"/);
  assert.match(source, /data-testid="support-widget-panel"/);
  assert.match(source, /data-testid="support-widget-search"/);
  assert.match(source, /data-testid="support-widget-suggestions"/);
  assert.match(source, /data-testid="support-widget-chat-thread"/);
  assert.match(source, /data-testid="support-widget-input"/);
  assert.match(source, /data-testid="support-widget-send"/);
  assert.match(source, /data-testid="support-widget-escalate"/);
  assert.match(source, /data-testid="support-widget-ticket-success"/);
  assert.match(source, /fetch\("\/api\/support\/escalate"/);
  assert.match(source, /Open full support page/);
  assert.match(source, /href="\/support"/);
  assert.match(source, /if\s*\(event\.key === "Escape"\)/);
});
