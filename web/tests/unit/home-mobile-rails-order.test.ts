import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("public mobile home renders inventory rails before long explainer copy", () => {
  const pagePath = path.join(process.cwd(), "app", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  const featuredRailIndex = source.indexOf('sectionTestId="mobile-home-featured-rail"');
  const featuredDiscoveryIndex = source.indexOf("<MobileFeaturedDiscoveryStrip />");
  const popularRailIndex = source.indexOf('sectionTestId="mobile-home-popular-rail"');
  const newRailIndex = source.indexOf('sectionTestId="mobile-home-new-rail"');
  const smartSearchIndex = source.indexOf('data-testid="mobile-home-smart-search-compact"');
  const whyAccordionIndex = source.indexOf('testId="mobile-home-why-propatyhub"');
  const whyTitleIndex = source.indexOf('title="Why PropatyHub?"');

  assert.ok(featuredRailIndex >= 0, "expected featured rail marker");
  assert.ok(featuredDiscoveryIndex >= 0, "expected featured discovery strip marker");
  assert.ok(popularRailIndex >= 0, "expected popular rail marker");
  assert.ok(newRailIndex >= 0, "expected new-this-week rail marker");
  assert.ok(smartSearchIndex >= 0, "expected compact smart-search marker");
  assert.ok(whyAccordionIndex >= 0, "expected collapsed why-propatyhub accordion marker");
  assert.ok(whyTitleIndex >= 0, "expected why-propatyhub title to remain present");
  assert.ok(featuredRailIndex < featuredDiscoveryIndex, "expected featured homes rail to render before discovery strip");
  assert.ok(featuredRailIndex < smartSearchIndex, "expected first rail above mobile smart search");
  assert.ok(featuredRailIndex < whyAccordionIndex, "expected first rail above why accordion");
  assert.ok(featuredRailIndex < whyTitleIndex, "expected first rail above why-propatyhub title");
});

void test("mobile why-propatyhub accordion is collapsed by default", () => {
  const pagePath = path.join(process.cwd(), "app", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  const accordionStart = source.indexOf('testId="mobile-home-why-propatyhub"');
  assert.ok(accordionStart >= 0, "expected why accordion marker");

  const accordionSnippet = source.slice(Math.max(0, accordionStart - 240), accordionStart + 240);
  assert.match(accordionSnippet, /defaultCollapsed/);
});

void test("home listing rails keep snap and peek class contract", () => {
  const railPath = path.join(process.cwd(), "components", "home", "HomeListingRail.tsx");
  const source = fs.readFileSync(railPath, "utf8");

  assert.match(source, /HorizontalSnapRail/);
  assert.match(source, /scroll-px-5/);
  assert.match(source, /scrollerClassName="px-5 pb-1 pr-5 scroll-px-5/);
  assert.match(source, /w-5 shrink-0/);
  assert.match(source, /snap-start snap-always/);
});
