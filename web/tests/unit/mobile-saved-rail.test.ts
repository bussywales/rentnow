import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("mobile saved rail source keeps stable testids and storage hooks", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileSavedRail.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="mobile-saved-rail"/);
  assert.match(source, /data-testid="mobile-saved-scroll"/);
  assert.match(source, /data-testid="mobile-saved-item"/);
  assert.match(source, /data-testid="mobile-saved-rail-clear"/);
  assert.match(source, /href="\/saved"/);
  assert.match(source, /getSavedItems/);
  assert.match(source, /subscribeSavedItems/);
  assert.match(source, /clearSavedItems/);
  assert.match(source, /TrustBadges/);
  assert.match(source, /resolveDiscoveryTrustBadges/);
});

void test("home page mounts mobile saved rail in inventory-first block", () => {
  const sourcePath = path.join(process.cwd(), "app", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /import\s+\{\s*MobileSavedRail\s*\}\s+from\s+"@\/components\/home\/MobileSavedRail"/);
  assert.match(source, /<MobileSavedRail \/>/);
  assert.ok(source.indexOf("<MobileFeaturedDiscoveryStrip />") < source.indexOf("<MobileSavedRail />"));
});
