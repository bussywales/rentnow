import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("tenant push diagnostics panel renders core copy", () => {
  const panelPath = path.join(
    process.cwd(),
    "components",
    "dashboard",
    "TenantPushDiagnosticsPanel.tsx"
  );
  const contents = fs.readFileSync(panelPath, "utf8");

  assert.ok(
    contents.includes("Notifications diagnostics"),
    "expected diagnostics heading"
  );
  assert.ok(
    contents.includes("Enable notifications"),
    "expected enable notifications CTA copy"
  );
  assert.ok(
    contents.includes("Finish setup"),
    "expected finish setup CTA copy"
  );
  assert.ok(
    contents.includes("Re-subscribe on this device"),
    "expected resubscribe CTA copy"
  );
});

void test("saved searches page includes tenant diagnostics panel", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "dashboard",
    "saved-searches",
    "page.tsx"
  );
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("TenantPushDiagnosticsPanel"),
    "expected tenant diagnostics panel to render on saved searches"
  );
});
