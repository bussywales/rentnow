import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileQuickStartBar } from "@/components/home/MobileQuickStartBar";
import { buildMobileQuickSearchHref } from "@/components/home/MobileQuickSearchSheet";

void test("mobile quick-start renders search entry and category shortcuts", () => {
  const html = renderToStaticMarkup(React.createElement(MobileQuickStartBar));

  assert.match(html, /data-testid="mobile-quickstart"/);
  assert.match(html, /Quick start/);
  assert.match(html, /data-testid="mobile-quickstart-search-trigger"/);
  assert.match(html, /data-testid="mobile-quickstart-chip-shortlets"/);
  assert.match(html, /href="\/shortlets"/);
  assert.match(html, /data-testid="mobile-quickstart-chip-rent"/);
  assert.match(html, /href="\/properties\?intent=rent"/);
  assert.match(html, /data-testid="mobile-quickstart-chip-sale"/);
  assert.match(html, /href="\/properties\?intent=sale"/);
  assert.match(html, /data-testid="mobile-quickstart-chip-offplan"/);
  assert.match(html, /href="\/properties\?intent=off_plan"/);
  assert.match(html, /data-testid="mobile-quickstart-chip-all"/);
  assert.match(html, /href="\/properties"/);
  assert.match(html, /md:hidden/);
  assert.match(html, /sticky top-\[72px\] z-20/);
  assert.match(html, /snap-x snap-mandatory/);
  assert.match(html, /scrollbar-none/);
});

void test("mobile quick search href builder maps category params safely", () => {
  const rentHref = buildMobileQuickSearchHref({ category: "rent" });
  const buyHref = buildMobileQuickSearchHref({ category: "buy", city: "Abuja" });
  const offPlanHref = buildMobileQuickSearchHref({ category: "off_plan", city: "Lagos" });

  const rentParams = new URLSearchParams(rentHref.split("?")[1] || "");
  const buyParams = new URLSearchParams(buyHref.split("?")[1] || "");
  const offPlanParams = new URLSearchParams(offPlanHref.split("?")[1] || "");

  assert.equal(rentParams.get("category"), "rent");
  assert.equal(rentParams.get("intent"), "rent");
  assert.equal(rentParams.get("page"), "1");

  assert.equal(buyParams.get("category"), "buy");
  assert.equal(buyParams.get("intent"), "buy");
  assert.equal(buyParams.get("city"), "Abuja");
  assert.equal(buyParams.get("page"), "1");

  assert.equal(offPlanParams.get("category"), "off_plan");
  assert.equal(offPlanParams.get("intent"), "off_plan");
  assert.equal(offPlanParams.get("listingIntent"), "off_plan");
  assert.equal(offPlanParams.get("city"), "Lagos");
  assert.equal(offPlanParams.get("page"), "1");
});

void test("public home mounts mobile quick-start before long-form hero content", () => {
  const pagePath = path.join(process.cwd(), "app", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  const quickStartIndex = source.indexOf("<MobileQuickStartBar");
  const heroIndex = source.indexOf('<section className="relative hidden overflow-hidden');

  assert.ok(quickStartIndex >= 0, "expected MobileQuickStartBar mount on public home");
  assert.ok(heroIndex >= 0, "expected hero section marker on public home");
  assert.ok(quickStartIndex < heroIndex, "expected quick-start block above hero section");
});
