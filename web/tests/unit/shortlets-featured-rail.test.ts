import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildShortletsFeaturedHref,
  selectShortletsFeaturedRailItems,
  type DiscoveryCatalogueItem,
} from "@/lib/discovery";

function createCatalogueItem(
  overrides: Partial<DiscoveryCatalogueItem> & Pick<DiscoveryCatalogueItem, "id">
): DiscoveryCatalogueItem {
  return {
    id: overrides.id,
    title: overrides.title ?? "Test item",
    subtitle: overrides.subtitle,
    kind: overrides.kind ?? "shortlet",
    intent: overrides.intent ?? "shortlet",
    marketTags: overrides.marketTags ?? ["GLOBAL"],
    params: overrides.params ?? {},
    priority: overrides.priority ?? 0,
    surfaces: overrides.surfaces ?? ["SHORTLETS_FEATURED"],
    disabled: overrides.disabled,
    validFrom: overrides.validFrom,
    validTo: overrides.validTo,
  };
}

void test("shortlets featured rail selection is market-safe and shortlet-only", () => {
  const items: DiscoveryCatalogueItem[] = [
    createCatalogueItem({
      id: "uk-shortlet-london",
      title: "London shortlet",
      marketTags: ["GB"],
      params: { where: "London" },
    }),
    createCatalogueItem({
      id: "global-shortlet-flexible",
      title: "Global shortlet",
      marketTags: ["GLOBAL"],
      params: { where: "Any city" },
    }),
    createCatalogueItem({
      id: "ng-shortlet-lagos",
      title: "Lagos shortlet",
      marketTags: ["NG"],
      params: { where: "Lagos" },
    }),
    createCatalogueItem({
      id: "uk-rent-card",
      title: "Rent card should be excluded",
      kind: "property",
      intent: "rent",
      marketTags: ["GB"],
      params: { city: "Manchester", category: "rent" },
    }),
  ];

  const selected = selectShortletsFeaturedRailItems({
    marketCountry: "GB",
    limit: 4,
    now: new Date("2026-02-25T00:00:00.000Z"),
    seedBucket: "unit",
    items,
  });

  assert.ok(selected.length >= 1);
  assert.equal(selected.some((item) => item.id === "ng-shortlet-lagos"), false);
  assert.equal(selected.some((item) => item.id === "uk-rent-card"), false);
  assert.ok(selected.every((item) => item.href.startsWith("/shortlets")));
});

void test("shortlets featured href keeps shortlets params and strips property-only params", () => {
  const item = createCatalogueItem({
    id: "mixed-params",
    params: {
      city: "Toronto",
      category: "buy",
      intent: "buy",
      listingIntent: "off_plan",
      guests: "2",
      sort: "recommended",
    },
  });

  const href = buildShortletsFeaturedHref({
    item,
    marketCountry: "CA",
  });

  assert.match(href, /^\/shortlets\?/);
  assert.match(href, /where=Toronto/);
  assert.match(href, /market=CA/);
  assert.match(href, /guests=2/);
  assert.equal(href.includes("category="), false);
  assert.equal(href.includes("intent="), false);
  assert.equal(href.includes("listingIntent="), false);
});

void test("shortlets featured rail source includes stable testids and snap rail contract", () => {
  const sourcePath = path.join(
    process.cwd(),
    "components",
    "shortlets",
    "discovery",
    "ShortletsFeaturedRail.tsx"
  );
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /import\s+\{\s*SaveToggle\s*\}\s+from\s+"@\/components\/saved\/SaveToggle"/);
  assert.match(source, /import\s+\{\s*TrustBadges\s*\}\s+from\s+"@\/components\/ui\/TrustBadges"/);
  assert.match(source, /testId=\{`save-toggle-\$\{item\.id\}`\}/);
  assert.match(source, /data-testid="shortlets-featured-rail"/);
  assert.match(source, /data-testid="shortlets-featured-item"/);
  assert.match(source, /role="region"/);
  assert.match(source, /aria-label=\{`Featured shortlet picks for \$\{market\.country\}`\}/);
  assert.match(source, /HorizontalSnapRail/);
  assert.match(source, /tabIndex:\s*0/);
  assert.match(source, /onKeyDown:\s*onRailKeyDown/);
  assert.match(source, /"aria-label": "Featured shortlets carousel"/);
  assert.match(source, /motion-reduce:scroll-auto/);
  assert.match(source, /snap-start snap-always/);
  assert.match(source, /useMarketPreference/);
});

void test("shortlets search shell mounts featured rail above results blocks", () => {
  const sourcePath = path.join(process.cwd(), "components", "shortlets", "search", "ShortletsSearchShell.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /<ShortletsFeaturedRail \/>/);
  assert.match(source, /data-testid="shortlets-results-label"/);
  assert.ok(
    source.indexOf("<ShortletsFeaturedRail />") <
      source.indexOf('data-testid="shortlets-results-label"')
  );
});

void test("shortlets page mounts the no-SSR shell wrapper to avoid hydration drift", () => {
  const pageSourcePath = path.join(process.cwd(), "app", "shortlets", "page.tsx");
  const pageSource = fs.readFileSync(pageSourcePath, "utf8");
  assert.match(pageSource, /ShortletsSearchShellNoSsr/);
  assert.match(pageSource, /<ShortletsSearchShellNoSsr/);

  const wrapperSourcePath = path.join(
    process.cwd(),
    "components",
    "shortlets",
    "search",
    "ShortletsSearchShellNoSsr.tsx"
  );
  const wrapperSource = fs.readFileSync(wrapperSourcePath, "utf8");
  assert.match(wrapperSource, /const ShortletsSearchShellClient = dynamic/);
  assert.match(wrapperSource, /ssr:\s*false/);
  assert.match(wrapperSource, /loading:\s*ShortletsSearchShellFallback/);
});
