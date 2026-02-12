import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSocialProofCounters,
  prioritizeHomesByMarketCountry,
  rankTrendingPropertyIds,
  scoreTrendingCounter,
} from "@/lib/tenant/tenant-social-proof.server";
import type { Property } from "@/lib/types";

const NOW = new Date("2026-02-12T12:00:00.000Z");

void test("trending score uses views + (saves * 4)", () => {
  assert.equal(scoreTrendingCounter({ views7: 3, saves7: 2 }), 11);
});

void test("trending ranking enforces minimum threshold of 3", () => {
  const rows = [
    {
      property_id: "prop-low",
      event_type: "property_view",
      occurred_at: "2026-02-12T11:00:00.000Z",
      meta: {},
    },
    {
      property_id: "prop-high",
      event_type: "save_toggle",
      occurred_at: "2026-02-12T10:00:00.000Z",
      meta: { action: "save" },
    },
  ];

  const counters = buildSocialProofCounters(rows, NOW);
  const ranked = rankTrendingPropertyIds(counters, 10);
  assert.deepEqual(ranked, ["prop-high"]);
});

void test("market preference orders matching country first without filtering others", () => {
  const homes = [
    { id: "a", country_code: "GB" },
    { id: "b", country_code: "NG" },
    { id: "c", country_code: "NG" },
    { id: "d", country_code: "US" },
  ] as Array<Pick<Property, "id" | "country_code">> as Property[];

  const ordered = prioritizeHomesByMarketCountry(homes, "NG");
  assert.deepEqual(
    ordered.map((home) => home.id),
    ["b", "c", "a", "d"]
  );
});

void test("no events produces empty trending candidates", () => {
  const counters = buildSocialProofCounters([], NOW);
  assert.deepEqual(rankTrendingPropertyIds(counters, 10), []);
});

