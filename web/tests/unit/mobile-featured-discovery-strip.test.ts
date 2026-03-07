import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildFeaturedDiscoveryHref,
  buildMobileQuickSearchHref,
  getMobileFeaturedDiscoveryItems,
  validateMobileFeaturedDiscoveryCatalogue,
} from "@/lib/home/mobile-featured-discovery";
import { DISCOVERY_CATALOGUE } from "@/lib/discovery";

const FIXED_NOW = new Date("2026-02-25T00:00:00.000Z");

void test("mobile featured discovery selection is market-aware with global fallback", () => {
  const ngItems = getMobileFeaturedDiscoveryItems({
    marketCountry: "NG",
    now: FIXED_NOW,
    limit: 6,
    seedBucket: "unit",
  });
  assert.ok(ngItems.length > 0);
  assert.ok(ngItems.some((item) => item.id.startsWith("ng-")));
  assert.ok(ngItems.some((item) => item.badges.includes("POPULAR")));

  const caItems = getMobileFeaturedDiscoveryItems({
    marketCountry: "CA",
    now: FIXED_NOW,
    limit: 6,
    seedBucket: "unit",
  });
  assert.ok(caItems.length > 0);
  assert.ok(caItems.some((item) => item.id.startsWith("ca-")));
  assert.equal(caItems.some((item) => item.id.startsWith("ng-")), false);

  const fallbackItems = getMobileFeaturedDiscoveryItems({
    marketCountry: "ZZ",
    now: FIXED_NOW,
    limit: 6,
    seedBucket: "unit",
  });
  assert.ok(fallbackItems.length > 0);
  assert.ok(fallbackItems.every((item) => item.id.startsWith("global-")));
});

void test("mobile featured discovery ordering is deterministic per market/date and rotates by date", () => {
  const dayOne = getMobileFeaturedDiscoveryItems({
    marketCountry: "NG",
    now: new Date("2026-02-25T00:00:00.000Z"),
    limit: 6,
    seedBucket: "unit",
  }).map((item) => item.id);
  const dayOneRepeat = getMobileFeaturedDiscoveryItems({
    marketCountry: "NG",
    now: new Date("2026-02-25T00:00:00.000Z"),
    limit: 6,
    seedBucket: "unit",
  }).map((item) => item.id);
  const weekOrders = Array.from({ length: 7 }, (_, index) =>
    getMobileFeaturedDiscoveryItems({
      marketCountry: "NG",
      now: new Date(`2026-02-${String(25 + index).padStart(2, "0")}T00:00:00.000Z`),
      limit: 6,
      seedBucket: "unit",
    })
      .map((item) => item.id)
      .join("|")
  );

  assert.deepEqual(dayOne, dayOneRepeat);
  assert.ok(new Set(weekOrders).size > 1);
  assert.equal(new Set(dayOne).size, dayOne.length);
});

void test("mobile featured discovery href mapping stays route-safe", () => {
  const selected = getMobileFeaturedDiscoveryItems({
    marketCountry: "NG",
    now: FIXED_NOW,
    limit: 6,
    seedBucket: "unit",
  });
  const shortlet = selected.find((item) => item.category === "shortlet");
  const rent = selected.find((item) => item.category === "rent");
  assert.ok(shortlet);
  assert.ok(rent);

  const shortletHref = buildFeaturedDiscoveryHref(shortlet);
  assert.match(shortletHref, /^\/shortlets/);
  if (shortlet.city) {
    assert.match(shortletHref, new RegExp(`where=${encodeURIComponent(shortlet.city)}`));
  }

  const rentHref = buildFeaturedDiscoveryHref(rent);
  assert.match(rentHref, /^\/properties/);
  assert.match(rentHref, /intent=/);
  assert.match(rentHref, /category=/);
});

void test("mobile quick search href builder maps shortlet v2 params safely", () => {
  const href = buildMobileQuickSearchHref({
    category: "shortlet",
    city: "Lekki",
    intent: "shortlet",
    guests: 3,
    checkIn: "2026-02-27",
    checkOut: "2026-03-01",
  });
  assert.match(href, /^\/shortlets\?/);
  assert.match(href, /where=Lekki/);
  assert.match(href, /guests=3/);
  assert.match(href, /checkIn=2026-02-27/);
  assert.match(href, /checkOut=2026-03-01/);
});

void test("mobile quick search href builder keeps property routes free of shortlet-only params", () => {
  const href = buildMobileQuickSearchHref({
    category: "rent",
    city: "Abuja",
    intent: "rent",
    guests: 5,
    checkIn: "2026-02-27",
    checkOut: "2026-03-01",
  });
  assert.match(href, /^\/properties\?/);
  assert.match(href, /city=Abuja/);
  assert.equal(href.includes("guests="), false);
  assert.equal(href.includes("checkIn="), false);
  assert.equal(href.includes("checkOut="), false);
});

void test("mobile featured discovery catalogue validator filters invalid entries safely", () => {
  const { items, warnings } = validateMobileFeaturedDiscoveryCatalogue({
    items: [
      ...DISCOVERY_CATALOGUE.slice(0, 2),
      {
        ...DISCOVERY_CATALOGUE[0],
        id: "",
      },
      {
        ...DISCOVERY_CATALOGUE[1],
        id: "invalid-market",
        marketTags: [] as Array<"GLOBAL" | "NG" | "GB" | "US" | "CA">,
      },
    ],
    now: FIXED_NOW,
  });

  assert.equal(items.length, 2);
  assert.ok(warnings.length >= 2);
});

void test("mobile featured discovery selection handles empty catalogue safely", () => {
  const selected = getMobileFeaturedDiscoveryItems({
    marketCountry: "NG",
    now: FIXED_NOW,
    items: [],
  });
  assert.deepEqual(selected, []);
});

void test("mobile featured strip source includes stable testids and snap scrolling classes", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileFeaturedDiscoveryStrip.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /import\s+\{\s*SaveToggle\s*\}\s+from\s+"@\/components\/saved\/SaveToggle"/);
  assert.match(source, /testId=\{`save-toggle-\$\{item\.id\}`\}/);
  assert.match(source, /data-testid="mobile-featured-strip"/);
  assert.match(source, /testId="mobile-featured-scroll"/);
  assert.match(source, /data-testid={`mobile-featured-item-\$\{item\.id\}`}/);
  assert.match(source, /data-testid="mobile-featured-item"/);
  assert.match(source, /role="region"/);
  assert.match(source, /aria-label=\{`Featured discovery picks for \$\{market\.country\}`\}/);
  assert.match(source, /HorizontalSnapRail/);
  assert.match(source, /"aria-label": "Featured discovery carousel"/);
  assert.match(source, /tabIndex:\s*0/);
  assert.match(source, /onKeyDown:\s*onRailKeyDown/);
  assert.match(source, /TrustBadges/);
  assert.match(source, /motion-reduce:scroll-auto/);
  assert.match(source, /snap-start snap-always/);
  assert.match(source, /useMarketPreference/);
});

void test("public home mounts mobile featured homes rail before featured discovery strip", () => {
  const sourcePath = path.join(process.cwd(), "app", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /<MobileQuickStartBar[^>]*\/>/);
  assert.match(source, /data-testid="mobile-home-inventory-first"/);
  assert.match(source, /<MobileFeaturedDiscoveryStrip \/>/);
  assert.match(source, /sectionTestId="mobile-home-featured-rail"/);
  assert.ok(source.indexOf("sectionTestId=\"mobile-home-featured-rail\"") < source.indexOf("<MobileFeaturedDiscoveryStrip />"));
});
