import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MOBILE_FEATURED_DISCOVERY_ITEMS,
  buildFeaturedDiscoveryHref,
} from "@/lib/home/mobile-featured-discovery";

void test("mobile featured discovery uses curated cards and href mapping", () => {
  assert.equal(MOBILE_FEATURED_DISCOVERY_ITEMS.length, 6);

  const shortlet = MOBILE_FEATURED_DISCOVERY_ITEMS.find((item) => item.id === "shortlet-lagos-weekend");
  assert.ok(shortlet);
  const shortletHref = buildFeaturedDiscoveryHref(shortlet);
  assert.match(shortletHref, /^\/shortlets/);
  assert.match(shortletHref, /where=Lagos/);

  const rent = MOBILE_FEATURED_DISCOVERY_ITEMS.find((item) => item.id === "rent-abuja-family");
  assert.ok(rent);
  const rentHref = buildFeaturedDiscoveryHref(rent);
  assert.match(rentHref, /^\/properties/);
  assert.match(rentHref, /intent=rent/);
  assert.match(rentHref, /category=rent/);
});

void test("mobile featured strip source includes stable testids and snap scrolling classes", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileFeaturedDiscoveryStrip.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="mobile-featured-strip"/);
  assert.match(source, /data-testid="mobile-featured-scroll"/);
  assert.match(source, /data-testid={`mobile-featured-item-\$\{item\.id\}`}/);
  assert.match(source, /data-testid="mobile-featured-item"/);
  assert.match(source, /snap-x snap-mandatory/);
  assert.match(source, /snap-start snap-always/);
});

void test("public home mounts mobile featured strip above mobile listing rails", () => {
  const sourcePath = path.join(process.cwd(), "app", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /<MobileQuickStartBar \/>/);
  assert.match(source, /data-testid="mobile-home-inventory-first"/);
  assert.match(source, /<MobileFeaturedDiscoveryStrip \/>/);
  assert.match(source, /sectionTestId="mobile-home-featured-rail"/);
  assert.ok(source.indexOf("<MobileFeaturedDiscoveryStrip />") < source.indexOf("sectionTestId=\"mobile-home-featured-rail\""));
});
