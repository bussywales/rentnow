import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveDiscoveryTrustBadges, resolveMarketPicksLabel } from "@/lib/discovery";

void test("resolveDiscoveryTrustBadges applies deterministic POPULAR and NEW rules", () => {
  const now = new Date("2026-02-26T00:00:00.000Z");

  const popular = resolveDiscoveryTrustBadges({
    now,
    item: {
      priority: 90,
      badges: [],
      introducedAt: undefined,
      validFrom: undefined,
      verificationBasis: undefined,
    },
  });
  assert.deepEqual(popular, ["POPULAR"]);

  const newlyIntroduced = resolveDiscoveryTrustBadges({
    now,
    item: {
      priority: 40,
      badges: [],
      introducedAt: "2026-02-22",
      validFrom: undefined,
      verificationBasis: undefined,
    },
  });
  assert.deepEqual(newlyIntroduced, ["NEW"]);
});

void test("resolveDiscoveryTrustBadges requires verification basis for VERIFIED", () => {
  const now = new Date("2026-02-26T00:00:00.000Z");
  const missingBasis = resolveDiscoveryTrustBadges({
    now,
    item: {
      priority: 20,
      badges: ["VERIFIED"],
      introducedAt: undefined,
      validFrom: undefined,
      verificationBasis: undefined,
    },
  });
  assert.deepEqual(missingBasis, []);

  const withBasis = resolveDiscoveryTrustBadges({
    now,
    item: {
      priority: 20,
      badges: ["VERIFIED"],
      introducedAt: undefined,
      validFrom: undefined,
      verificationBasis: "MANUAL_REVIEW",
    },
  });
  assert.deepEqual(withBasis, ["VERIFIED"]);
});

void test("market picks label maps supported markets and falls back safely", () => {
  assert.equal(resolveMarketPicksLabel("US"), "Picks for United States");
  assert.equal(resolveMarketPicksLabel("GB"), "Picks for United Kingdom");
  assert.equal(resolveMarketPicksLabel("ZZ"), "Picks for Global");
});

void test("trust badges UI source includes stable testids and market indicator", () => {
  const sourcePath = path.join(process.cwd(), "components", "ui", "TrustBadges.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="trust-badges"/);
  assert.match(source, /data-testid="trust-badge"/);
  assert.match(source, /data-testid="trust-market-picks"/);
  assert.match(source, /resolveMarketPicksLabel/);
});

void test("featured and saved surfaces mount trust badges consistently", () => {
  const files = [
    path.join(process.cwd(), "components", "home", "MobileFeaturedDiscoveryStrip.tsx"),
    path.join(process.cwd(), "components", "shortlets", "discovery", "ShortletsFeaturedRail.tsx"),
    path.join(process.cwd(), "components", "properties", "discovery", "PropertiesFeaturedRail.tsx"),
    path.join(process.cwd(), "components", "collections", "CollectionRail.tsx"),
    path.join(process.cwd(), "components", "home", "MobileSavedRail.tsx"),
  ];

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.match(source, /TrustBadges/);
  }
});

