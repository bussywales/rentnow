import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host home renders media-first hero and listings rail before technical sections", () => {
  const hostPagePath = path.join(process.cwd(), "app", "host", "page.tsx");
  const contents = fs.readFileSync(hostPagePath, "utf8");

  const heroIndex = contents.indexOf('data-testid="host-home-hero"');
  const listingsRailIndex = contents.indexOf("<HostListingsRail");
  const approvalTipsIndex = contents.indexOf("Getting approved faster");
  const checklistIndex = contents.indexOf("<HostGettingStartedSection");

  assert.ok(heroIndex >= 0, "expected host hero marker");
  assert.ok(listingsRailIndex >= 0, "expected host listings rail render");
  assert.ok(approvalTipsIndex >= 0, "expected approval tips panel marker");
  assert.ok(checklistIndex >= 0, "expected host checklist section marker");
  assert.ok(heroIndex < listingsRailIndex, "expected hero above listings rail");
  assert.ok(
    listingsRailIndex < approvalTipsIndex,
    "expected listings rail before approval tips panel"
  );
  assert.ok(
    listingsRailIndex < checklistIndex,
    "expected listings rail before checklist section"
  );
});

void test("host listings rail card keeps media + primary action markers", () => {
  const railPath = path.join(process.cwd(), "components", "host", "HostListingsRail.tsx");
  const contents = fs.readFileSync(railPath, "utf8");

  assert.match(contents, /data-testid="host-home-listings-rail"/);
  assert.match(contents, /h-44/);
  assert.match(contents, /Open listing/);
});
