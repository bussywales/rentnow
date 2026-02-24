import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("/home renders featured/new/saved/viewed rails before technical panels", () => {
  const pagePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const feedPath = path.join(process.cwd(), "components", "home", "WorkspaceHomeFeed.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");
  const feedContents = fs.readFileSync(feedPath, "utf8");

  const featuredStripIndex = feedContents.indexOf('data-testid="home-featured-strip"');
  const forYouGridIndex = feedContents.indexOf('data-testid="home-for-you-grid"');
  const feedMountIndex = contents.indexOf("<WorkspaceHomeFeed");
  const workspaceToolsIndex = contents.indexOf('testId="home-workspace-tools"');
  const checklistIndex = contents.indexOf('testId="home-getting-started"');
  const snapshotIndex = contents.indexOf('testId="home-snapshot-panel"');
  const analyticsIndex = contents.indexOf('testId="home-analytics-panel"');
  const demandAlertsIndex = contents.indexOf('testId="home-demand-alerts"');

  assert.ok(feedMountIndex >= 0, "expected workspace feed mount");
  assert.ok(featuredStripIndex >= 0, "expected featured strip marker");
  assert.ok(forYouGridIndex >= 0, "expected for-you grid marker");
  assert.ok(workspaceToolsIndex >= 0, "expected workspace tools marker");
  assert.ok(checklistIndex >= 0, "expected checklist marker");
  assert.ok(snapshotIndex >= 0, "expected snapshot marker");
  assert.ok(analyticsIndex >= 0, "expected analytics marker");
  assert.ok(demandAlertsIndex >= 0, "expected demand alerts marker");

  assert.ok(feedMountIndex < workspaceToolsIndex, "expected workspace feed above technical tools");
  assert.ok(forYouGridIndex < checklistIndex, "expected for-you grid above checklist");
  assert.ok(forYouGridIndex < snapshotIndex, "expected for-you grid above snapshot");
  assert.ok(forYouGridIndex < analyticsIndex, "expected for-you grid above analytics");
  assert.ok(forYouGridIndex < demandAlertsIndex, "expected for-you grid above demand alerts");
});

void test("/home hero CTA points to canonical host properties manager", () => {
  const feedPath = path.join(process.cwd(), "components", "home", "WorkspaceHomeFeed.tsx");
  const contents = fs.readFileSync(feedPath, "utf8");

  assert.match(contents, /href=\"\/host\/properties\"/);
});
