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
  assert.match(source, /role="region"/);
  assert.match(source, /aria-label=\{`Recently viewed for \$\{market\.country\}`\}/);
  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /onKeyDown=\{onRailKeyDown\}/);
  assert.match(source, /scroll-smooth motion-reduce:scroll-auto/);
  assert.match(source, /getViewedItems/);
  assert.match(source, /subscribeViewedItems/);
  assert.match(source, /clearViewedItems/);
  assert.match(source, /if \(!displayItems\.length\) return null;/);
  assert.doesNotMatch(source, /mobile-recently-viewed-empty-suggestions/);
});

void test("home page mounts mobile recently viewed rail in inventory-first block", () => {
  const sourcePath = path.join(process.cwd(), "app", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /import\s+\{\s*MobileRecentlyViewedRail\s*\}\s+from\s+"@\/components\/home\/MobileRecentlyViewedRail"/);
  assert.match(source, /<MobileRecentlyViewedRail \/>/);
  assert.ok(source.indexOf("sectionTestId=\"mobile-home-featured-rail\"") < source.indexOf("<MobileRecentlyViewedRail />"));
});
