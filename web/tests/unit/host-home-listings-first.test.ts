import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host home renders media-first hero and listings grid before technical sections", () => {
  const hostPagePath = path.join(process.cwd(), "app", "host", "page.tsx");
  const contents = fs.readFileSync(hostPagePath, "utf8");

  const heroIndex = contents.indexOf('data-testid="host-home-hero"');
  const listingsGridIndex = contents.indexOf("<HostListingsFeed");
  const approvalTipsIndex = contents.indexOf("Getting approved faster");
  const checklistIndex = contents.indexOf("<HostGettingStartedSection");

  assert.ok(heroIndex >= 0, "expected host hero marker");
  assert.ok(listingsGridIndex >= 0, "expected host listings grid render");
  assert.ok(approvalTipsIndex >= 0, "expected approval tips panel marker");
  assert.ok(checklistIndex >= 0, "expected host checklist section marker");
  assert.ok(heroIndex < listingsGridIndex, "expected hero above listings grid");
  assert.ok(
    listingsGridIndex < approvalTipsIndex,
    "expected listings grid before approval tips panel"
  );
  assert.ok(
    listingsGridIndex < checklistIndex,
    "expected listings grid before checklist section"
  );
});

void test("host listings grid card keeps media + primary action markers", () => {
  const gridPath = path.join(process.cwd(), "components", "host", "HostListingsMasonryGrid.tsx");
  const contents = fs.readFileSync(gridPath, "utf8");

  assert.match(contents, /data-testid="host-home-listings-grid"/);
  assert.match(contents, /auto-rows-\[8px\]/);
  assert.match(contents, /Open listing/);
});
