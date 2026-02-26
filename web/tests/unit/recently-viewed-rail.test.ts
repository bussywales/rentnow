import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("mobile recently viewed rail includes stable testids and viewed-store hooks", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileRecentlyViewedRail.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="mobile-recently-viewed-rail"/);
  assert.match(source, /data-testid="mobile-recently-viewed-scroll"/);
  assert.match(source, /data-testid="mobile-recently-viewed-item"/);
  assert.match(source, /data-testid="mobile-recently-viewed-clear"/);
  assert.match(source, /getViewedItems/);
  assert.match(source, /subscribeViewedItems/);
  assert.match(source, /clearViewedItems/);
});

void test("home page mounts mobile recently viewed rail in inventory-first block", () => {
  const sourcePath = path.join(process.cwd(), "app", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /import\s+\{\s*MobileRecentlyViewedRail\s*\}\s+from\s+"@\/components\/home\/MobileRecentlyViewedRail"/);
  assert.match(source, /<MobileRecentlyViewedRail \/>/);
  assert.ok(source.indexOf("<MobileFeaturedDiscoveryStrip />") < source.indexOf("<MobileRecentlyViewedRail />"));
});
