import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("/home technical sections default to collapsed and persist scoped keys", () => {
  const filePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /const technicalPanelsCollapsedByDefault = true/);
  assert.match(source, /const HOME_COLLAPSIBLE_KEY_VERSION = "v3"/);
  assert.match(source, /defaultCollapsed=\{technicalPanelsCollapsedByDefault\}/);
  assert.match(source, /version: HOME_COLLAPSIBLE_KEY_VERSION/);
  assert.match(source, /section: "workspace-tools"/);
  assert.match(source, /section: "getting-started"/);
  assert.match(source, /section: "snapshot"/);
  assert.match(source, /section: "analytics-preview"/);
  assert.match(source, /section: "demand-alerts"/);
  assert.match(source, /section: "ops-diagnostics"/);
  assert.match(source, /testId="home-ops-diagnostics"/);
});
