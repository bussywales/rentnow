import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildMobileQuickSearchHref } from "@/components/home/MobileQuickSearchSheet";

void test("mobile quick-start renders search entry and category shortcuts", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileQuickStartBar.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="mobile-quickstart"/);
  assert.match(source, /Quick start/);
  assert.match(source, /data-testid="mobile-quickstart-search-trigger"/);
  assert.match(source, /data-testid={`mobile-quickstart-chip-\$\{entry\.key\}`}/);
  assert.match(source, /href=\{entry\.href\}/);
  assert.match(source, /md:hidden/);
  assert.match(source, /sticky top-\[72px\] z-20/);
  assert.match(source, /snap-x snap-mandatory/);
  assert.match(source, /scrollbar-none/);
});

void test("mobile quick search href builder maps category params safely", () => {
  const rentHref = buildMobileQuickSearchHref({ category: "rent" });
  const buyHref = buildMobileQuickSearchHref({ category: "buy", city: "Abuja" });
  const offPlanHref = buildMobileQuickSearchHref({ category: "off_plan", city: "Lagos" });
  const shortletHref = buildMobileQuickSearchHref({
    category: "shortlet",
    city: "Lekki",
    shortletParams: { checkIn: "2026-03-02", checkOut: "2026-03-05", guests: "2" },
  });

  const rentParams = new URLSearchParams(rentHref.split("?")[1] || "");
  const buyParams = new URLSearchParams(buyHref.split("?")[1] || "");
  const offPlanParams = new URLSearchParams(offPlanHref.split("?")[1] || "");
  const shortletParams = new URLSearchParams(shortletHref.split("?")[1] || "");

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

  assert.match(shortletHref, /^\/shortlets(\?|$)/);
  assert.equal(shortletParams.get("where"), "Lekki");
  assert.equal(shortletParams.get("checkIn"), "2026-03-02");
  assert.equal(shortletParams.get("checkOut"), "2026-03-05");
  assert.equal(shortletParams.get("guests"), "2");
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
