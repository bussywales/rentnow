import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildMobileQuickSearchHref } from "@/lib/home/mobile-featured-discovery";
import { getPropertyRequestQuickStartEntry } from "@/lib/requests/property-request-entry";

void test("mobile quick-start renders search entry and category shortcuts", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileQuickStartBar.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="mobile-quickstart"/);
  assert.match(source, /Quick start/);
  assert.match(source, /data-testid="mobile-quickstart-search-trigger"/);
  assert.match(source, /aria-haspopup="dialog"/);
  assert.match(source, /aria-expanded=\{searchOpen\}/);
  assert.match(source, /aria-controls=\{quickSearchSheetId\}/);
  assert.match(source, /data-testid={`mobile-quickstart-chip-\$\{entry\.key\}`}/);
  assert.match(source, /href=\{entry\.href\}/);
  assert.match(source, /data-testid="mobile-quickstart-chip-request"/);
  assert.match(source, /requestAction\.label/);
  assert.match(source, /requestAction\.href/);
  assert.equal(
    source.split('data-testid="mobile-quickstart-chip-request"').length - 1,
    1,
    "expected a single request quick-start chip marker"
  );
  assert.match(source, /md:hidden/);
  assert.match(source, /sticky top-\[72px\] z-20/);
  assert.match(source, /snap-x snap-mandatory/);
  assert.match(source, /scrollbar-none/);
});

void test("property request quick-start entry is tenant-safe and login-safe", () => {
  assert.deepEqual(getPropertyRequestQuickStartEntry("tenant"), {
    label: "Make a Request",
    href: "/requests/new",
  });

  assert.deepEqual(getPropertyRequestQuickStartEntry(null), {
    label: "Make a Request",
    href: "/auth/login?reason=auth&redirect=%2Frequests%2Fnew",
  });
});

void test("property request quick-start entry stays hidden for non-seeker roles", () => {
  assert.equal(getPropertyRequestQuickStartEntry("landlord"), null);
  assert.equal(getPropertyRequestQuickStartEntry("agent"), null);
  assert.equal(getPropertyRequestQuickStartEntry("admin"), null);
});

void test("mobile quick search href builder maps category params safely", () => {
  const rentHref = buildMobileQuickSearchHref({ category: "rent" });
  const buyHref = buildMobileQuickSearchHref({ category: "buy", city: "Abuja" });
  const offPlanHref = buildMobileQuickSearchHref({ category: "off_plan", city: "Lagos" });
  const shortletHref = buildMobileQuickSearchHref({
    category: "shortlet",
    city: "Lekki",
    shortletParams: { checkIn: "2026-03-02", checkOut: "2026-03-05", guests: "2" },
    checkIn: "2026-03-02",
    checkOut: "2026-03-05",
    guests: 2,
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
  const heroIndex = source.indexOf('data-testid="desktop-home-hero"');

  assert.ok(quickStartIndex >= 0, "expected MobileQuickStartBar mount on public home");
  assert.ok(heroIndex >= 0, "expected hero section marker on public home");
  assert.ok(quickStartIndex < heroIndex, "expected quick-start block above hero section");
  assert.match(source, /getPropertyRequestQuickStartEntry\(role\)/);
  assert.match(source, /requestAction=\{requestQuickStartEntry\}/);
});
