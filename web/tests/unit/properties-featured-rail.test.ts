import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildPropertiesFeaturedHref,
  selectPropertiesFeaturedRailItems,
  type DiscoveryCatalogueItem,
} from "@/lib/discovery";

function createCatalogueItem(
  overrides: Partial<DiscoveryCatalogueItem> & Pick<DiscoveryCatalogueItem, "id">
): DiscoveryCatalogueItem {
  return {
    id: overrides.id,
    title: overrides.title ?? "Test item",
    subtitle: overrides.subtitle,
    kind: overrides.kind ?? "property",
    intent: overrides.intent ?? "rent",
    marketTags: overrides.marketTags ?? ["GLOBAL"],
    params: overrides.params ?? {},
    priority: overrides.priority ?? 0,
    surfaces: overrides.surfaces ?? ["PROPERTIES_FEATURED"],
    disabled: overrides.disabled,
    validFrom: overrides.validFrom,
    validTo: overrides.validTo,
  };
}

void test("properties featured rail selection is market-safe and routes to properties", () => {
  const items: DiscoveryCatalogueItem[] = [
    createCatalogueItem({
      id: "ca-rent-vancouver",
      title: "Vancouver rentals",
      marketTags: ["CA"],
      params: { category: "rent", intent: "rent", city: "Vancouver" },
    }),
    createCatalogueItem({
      id: "global-buy-verified",
      title: "Global verified homes",
      marketTags: ["GLOBAL"],
      params: { category: "buy", intent: "buy" },
    }),
    createCatalogueItem({
      id: "ng-buy-lagos",
      title: "Lagos homes",
      marketTags: ["NG"],
      params: { category: "buy", intent: "buy", city: "Lagos" },
    }),
  ];

  const selected = selectPropertiesFeaturedRailItems({
    marketCountry: "CA",
    limit: 4,
    now: new Date("2026-02-25T00:00:00.000Z"),
    seedBucket: "unit",
    items,
  });

  assert.ok(selected.length >= 1);
  assert.equal(selected.some((item) => item.id === "ng-buy-lagos"), false);
  assert.ok(selected.every((item) => item.href.startsWith("/properties")));
});

void test("properties featured href uses category mapping and does not inject market params", () => {
  const item = createCatalogueItem({
    id: "offplan-montreal",
    intent: "buy",
    params: {
      category: "off_plan",
      intent: "off_plan",
      listingIntent: "off_plan",
      city: "Montreal",
      market: "CA",
    },
  });

  const href = buildPropertiesFeaturedHref(item);
  assert.match(href, /^\/properties\?/);
  assert.match(href, /category=off_plan/);
  assert.match(href, /intent=off_plan/);
  assert.match(href, /listingIntent=off_plan/);
  assert.match(href, /city=Montreal/);
  assert.equal(href.includes("market="), false);
});

void test("properties featured rail source includes stable testids and snap rail contract", () => {
  const sourcePath = path.join(
    process.cwd(),
    "components",
    "properties",
    "discovery",
    "PropertiesFeaturedRail.tsx"
  );
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /import\s+\{\s*SaveToggle\s*\}\s+from\s+"@\/components\/saved\/SaveToggle"/);
  assert.match(source, /import\s+\{\s*TrustBadges\s*\}\s+from\s+"@\/components\/ui\/TrustBadges"/);
  assert.match(source, /testId=\{`save-toggle-\$\{item\.id\}`\}/);
  assert.match(source, /data-testid="properties-featured-rail"/);
  assert.match(source, /data-testid="properties-featured-item"/);
  assert.match(source, /role="region"/);
  assert.match(source, /aria-label=\{`Featured property picks for \$\{market\.country\}`\}/);
  assert.match(source, /HorizontalSnapRail/);
  assert.match(source, /tabIndex:\s*0/);
  assert.match(source, /onKeyDown:\s*onRailKeyDown/);
  assert.match(source, /"aria-label": "Featured properties carousel"/);
  assert.match(source, /motion-reduce:scroll-auto/);
  assert.match(source, /snap-start snap-always/);
  assert.match(source, /h-\[252px\]/);
  assert.match(source, /mt-auto flex min-h-\[112px\] flex-col justify-end/);
  assert.match(source, /line-clamp-3 text-xs text-white\/90/);
  assert.match(source, /useMarketPreference/);
});

void test("properties page mounts featured rail above search controls", () => {
  const sourcePath = path.join(process.cwd(), "app", "properties", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /<PropertiesFeaturedRail \/>/);
  assert.match(source, /<SmartSearchBox mode="browse" autoFocusInput={openSearch} \/>/);
  assert.ok(
    source.indexOf("<PropertiesFeaturedRail />") <
      source.indexOf("<SmartSearchBox mode=\"browse\" autoFocusInput={openSearch} />")
  );
});
