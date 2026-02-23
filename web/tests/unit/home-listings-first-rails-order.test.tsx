import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("/home renders featured/new/saved/viewed rails before technical panels", () => {
  const pagePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  const featuredStripIndex = contents.indexOf('data-testid="home-featured-strip"');
  const newThisWeekIndex = contents.indexOf('data-testid="home-rail-new-this-week"');
  const mostSavedIndex = contents.indexOf('data-testid="home-rail-most-saved"');
  const mostViewedIndex = contents.indexOf('data-testid="home-rail-most-viewed"');
  const forYouGridIndex = contents.indexOf('data-testid="home-for-you-grid"');
  const workspaceToolsIndex = contents.indexOf('testId="home-workspace-tools"');
  const checklistIndex = contents.indexOf('testId="home-getting-started"');
  const snapshotIndex = contents.indexOf('testId="home-snapshot-panel"');
  const demandAlertsIndex = contents.indexOf('testId="home-demand-alerts"');

  assert.ok(featuredStripIndex >= 0, "expected featured strip marker");
  assert.ok(newThisWeekIndex >= 0, "expected new-this-week rail marker");
  assert.ok(mostSavedIndex >= 0, "expected most-saved rail marker");
  assert.ok(mostViewedIndex >= 0, "expected most-viewed rail marker");
  assert.ok(forYouGridIndex >= 0, "expected for-you grid marker");
  assert.ok(workspaceToolsIndex >= 0, "expected workspace tools marker");
  assert.ok(checklistIndex >= 0, "expected checklist marker");
  assert.ok(snapshotIndex >= 0, "expected snapshot marker");
  assert.ok(demandAlertsIndex >= 0, "expected demand alerts marker");

  assert.ok(featuredStripIndex < workspaceToolsIndex, "expected featured strip above technical tools");
  assert.ok(newThisWeekIndex < workspaceToolsIndex, "expected new-this-week rail above technical tools");
  assert.ok(mostSavedIndex < workspaceToolsIndex, "expected most-saved rail above technical tools");
  assert.ok(mostViewedIndex < workspaceToolsIndex, "expected most-viewed rail above technical tools");
  assert.ok(forYouGridIndex < checklistIndex, "expected for-you grid above checklist");
  assert.ok(forYouGridIndex < snapshotIndex, "expected for-you grid above snapshot");
  assert.ok(forYouGridIndex < demandAlertsIndex, "expected for-you grid above demand alerts");
});

void test("/home hero CTA points to canonical host properties manager", () => {
  const pagePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.match(contents, /href=\"\/host\/properties\"/);
});
