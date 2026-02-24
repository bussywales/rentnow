import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("workspace home wires featured rail component with the visual landing section", () => {
  const pagePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const feedPath = path.join(process.cwd(), "components", "home", "WorkspaceHomeFeed.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");
  const feedContents = fs.readFileSync(feedPath, "utf8");

  assert.match(contents, /<WorkspaceHomeFeed[\s\S]*role=\{role\}/);
  assert.match(contents, /displayName=\{displayName\}/);
  assert.match(contents, /priorityLine=\{heroPriorityLine\}/);
  assert.match(feedContents, /data-testid=\"home-featured-strip\"/);
  assert.match(feedContents, /<HostFeaturedStrip listings=\{listings\} mosaicTargetId=\"home-for-you-grid\" \/>/);
  assert.match(feedContents, /data-testid=\"home-for-you-grid\"/);
  assert.match(feedContents, /data-testid=\"home-workspace-priority-line\"/);
});

void test("home listing rail keeps premium snap + peek class contract", () => {
  const railPath = path.join(process.cwd(), "components", "host", "HostFeaturedStrip.tsx");
  const railSource = fs.readFileSync(railPath, "utf8");

  assert.match(railSource, /scrollbar-none/);
  assert.match(railSource, /scroll-px-5/);
  assert.match(railSource, /snap-start snap-always/);
  assert.match(railSource, /aspect-\[4\/3\]/);
});
