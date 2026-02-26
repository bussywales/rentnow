import test from "node:test";
import assert from "node:assert/strict";
import { DISCOVERY_CATALOGUE, validateDiscoveryCatalogue } from "@/lib/discovery";
import {
  validateCollectionsRegistry,
  getCollectionsRegistryDiagnostics,
} from "@/lib/collections/collections-registry";
import { buildAdminDiscoveryHealthSnapshot } from "@/lib/admin/discovery-health";

const NOW = new Date("2026-02-26T00:00:00.000Z");

void test("discovery diagnostics mode returns structured issues and filtered counts", () => {
  const base = DISCOVERY_CATALOGUE[0];
  const result = validateDiscoveryCatalogue({
    now: NOW,
    mode: "diagnostics",
    items: [
      base,
      { ...base },
      { ...base, id: "bad-kind", kind: "invalid" as never },
      { ...base, id: "disabled-item", disabled: true },
      { ...base, id: "expired-item", validTo: "2026-02-24" },
      { ...base, id: "future-item", validFrom: "2026-03-01" },
      { ...base, id: "missing-params", params: {} },
    ],
  });

  assert.ok(result.diagnostics);
  assert.equal(result.items.length, 1);
  assert.equal(result.diagnostics?.validCount, 1);
  assert.equal(result.diagnostics?.disabledCount, 1);
  assert.equal(result.diagnostics?.expiredCount, 1);
  assert.equal(result.diagnostics?.notYetActiveCount, 1);
  assert.ok(result.diagnostics?.issues.some((issue) => issue.reasonCodes.includes("DUPLICATE_ID")));
  assert.ok(
    result.diagnostics?.issues.some((issue) =>
      issue.reasonCodes.includes("MISSING_REQUIRED_PARAM_FOR_KIND")
    )
  );
});

void test("runtime validation mode remains backward compatible without diagnostics payload", () => {
  const base = DISCOVERY_CATALOGUE[0];
  const result = validateDiscoveryCatalogue({
    now: NOW,
    items: [base, { ...base }],
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.diagnostics, undefined);
  assert.ok(result.warnings.some((warning) => warning.includes("duplicate id")));
});

void test("collections diagnostics mode exposes structured reasons", () => {
  const result = validateCollectionsRegistry({
    now: NOW,
    mode: "diagnostics",
    items: [
      {
        slug: "ok-slug",
        title: "Valid collection",
        description: "Valid description",
        surface: "SHORTLETS_FEATURED",
        primaryKind: "shortlet",
        intent: "shortlet",
        marketTags: ["ALL"],
        params: { sort: "recommended" },
      },
      {
        slug: "ok-slug",
        title: "Duplicate collection",
        description: "Duplicate",
        surface: "SHORTLETS_FEATURED",
        primaryKind: "shortlet",
        intent: "shortlet",
        marketTags: ["ALL"],
        params: { sort: "recommended" },
      },
      {
        slug: "bad-market",
        title: "Bad market",
        description: "Bad market",
        surface: "SHORTLETS_FEATURED",
        primaryKind: "shortlet",
        intent: "shortlet",
        marketTags: ["ZZ" as never],
        params: { sort: "recommended" },
      },
      {
        slug: "disabled-collection",
        title: "Disabled collection",
        description: "Disabled",
        surface: "SHORTLETS_FEATURED",
        primaryKind: "shortlet",
        intent: "shortlet",
        marketTags: ["ALL"],
        params: { sort: "recommended" },
        disabled: true,
      },
    ],
  });

  assert.ok(result.diagnostics);
  assert.equal(result.items.length, 1);
  assert.equal(result.diagnostics?.disabledCount, 1);
  assert.ok(result.diagnostics?.issues.some((issue) => issue.reasonCodes.includes("DUPLICATE_SLUG")));
  assert.ok(result.diagnostics?.issues.some((issue) => issue.reasonCodes.includes("INVALID_MARKET_TAG")));
});

void test("admin discovery health snapshot includes market and surface breakdown", () => {
  const collections = getCollectionsRegistryDiagnostics(NOW);
  assert.ok(collections.items.length > 0);

  const snapshot = buildAdminDiscoveryHealthSnapshot(NOW);
  assert.ok(snapshot.counts.markets.NG >= 0);
  assert.ok(snapshot.counts.markets.CA >= 0);
  assert.ok(snapshot.counts.markets.UK >= 0);
  assert.ok(snapshot.counts.markets.US >= 0);
  assert.ok(snapshot.counts.markets.GLOBAL >= 0);
  assert.ok(snapshot.counts.surfaces.HOME_FEATURED >= 0);
  assert.ok(snapshot.counts.surfaces.SHORTLETS_FEATURED >= 0);
  assert.ok(snapshot.counts.surfaces.PROPERTIES_FEATURED >= 0);
  assert.ok(snapshot.counts.surfaces.COLLECTIONS >= 0);
  assert.ok(snapshot.coverage.rows.length > 0);
  assert.ok(snapshot.coverage.overallCoverageScore >= 0);
  assert.ok(snapshot.brokenRoutes.totalCount >= 0);
  assert.ok(Array.isArray(snapshot.brokenRoutes.reasonCounts));
});
