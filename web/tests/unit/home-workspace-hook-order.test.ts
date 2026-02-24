import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("/home keeps listings-first hook sections above technical workspace panels", () => {
  const pagePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const feedPath = path.join(process.cwd(), "components", "home", "WorkspaceHomeFeed.tsx");
  const pageSource = fs.readFileSync(pagePath, "utf8");
  const feedSource = fs.readFileSync(feedPath, "utf8");

  const feedMountIndex = pageSource.indexOf("<WorkspaceHomeFeed");
  const workspaceToolsIndex = pageSource.indexOf('testId="home-workspace-tools"');
  const checklistIndex = pageSource.indexOf('testId="home-getting-started"');
  const analyticsIndex = pageSource.indexOf('testId="home-analytics-panel"');

  assert.ok(feedMountIndex >= 0, "expected /home to mount workspace feed");
  assert.ok(workspaceToolsIndex >= 0, "expected technical workspace tools section");
  assert.ok(checklistIndex >= 0, "expected checklist section");
  assert.ok(analyticsIndex >= 0, "expected analytics section");
  assert.ok(feedMountIndex < workspaceToolsIndex, "expected feed above workspace tools");
  assert.ok(feedMountIndex < checklistIndex, "expected feed above checklist");
  assert.ok(feedMountIndex < analyticsIndex, "expected feed above analytics");

  assert.match(feedSource, /data-testid="home-workspace-hero"/);
  assert.match(feedSource, /data-testid="home-featured-strip"/);
  assert.match(feedSource, /data-testid="home-for-you-grid"/);
  assert.match(feedSource, /href="\/host\/listings\?view=manage"/);
});
