import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("/home renders featured + for-you listing rails before technical panels", () => {
  const pagePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  const featuredStripIndex = contents.indexOf('data-testid="home-featured-strip"');
  const forYouGridIndex = contents.indexOf('data-testid="home-for-you-grid"');
  const workspaceToolsIndex = contents.indexOf('data-testid="home-workspace-tools"');
  const checklistIndex = contents.indexOf('data-testid="home-getting-started"');
  const snapshotIndex = contents.indexOf('data-testid="home-snapshot-panel"');
  const demandAlertsIndex = contents.indexOf('data-testid="home-demand-alerts"');

  assert.ok(featuredStripIndex >= 0, "expected featured strip marker");
  assert.ok(forYouGridIndex >= 0, "expected for-you grid marker");
  assert.ok(workspaceToolsIndex >= 0, "expected workspace tools marker");
  assert.ok(checklistIndex >= 0, "expected checklist marker");
  assert.ok(snapshotIndex >= 0, "expected snapshot marker");
  assert.ok(demandAlertsIndex >= 0, "expected demand alerts marker");

  assert.ok(featuredStripIndex < workspaceToolsIndex, "expected featured strip above technical tools");
  assert.ok(forYouGridIndex < checklistIndex, "expected for-you grid above checklist");
  assert.ok(forYouGridIndex < snapshotIndex, "expected for-you grid above snapshot");
  assert.ok(forYouGridIndex < demandAlertsIndex, "expected for-you grid above demand alerts");
});

void test("/home hero CTA points to canonical host properties manager", () => {
  const pagePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.match(contents, /href=\"\/host\/properties\"/);
});
