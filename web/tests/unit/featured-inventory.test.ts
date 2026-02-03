import test from "node:test";
import assert from "node:assert/strict";
import { buildFeaturedInventorySummary } from "@/lib/admin/featured-inventory";

void test("featured inventory summary segments and sorts listings", () => {
  const now = new Date("2026-02-03T12:00:00Z");
  const iso = (days: number) =>
    new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const items = [
    {
      id: "a",
      title: "Alpha",
      city: "Lagos",
      status: "live",
      featured_rank: 2,
      featured_until: iso(10),
      updated_at: iso(-1),
    },
    {
      id: "b",
      title: "Bravo",
      city: "Lagos",
      status: "live",
      featured_rank: 1,
      featured_until: iso(20),
      updated_at: iso(-2),
    },
    {
      id: "c",
      title: "Charlie",
      city: "Accra",
      status: "paused_owner",
      featured_rank: null,
      featured_until: null,
      updated_at: iso(-3),
    },
    {
      id: "d",
      title: "Delta",
      city: "Lagos",
      status: "live",
      featured_rank: 3,
      featured_until: iso(2),
      updated_at: iso(-4),
    },
    {
      id: "e",
      title: "Echo",
      city: "Lagos",
      status: "live",
      featured_rank: 5,
      featured_until: iso(-1),
      updated_at: iso(-5),
    },
  ];

  const summary = buildFeaturedInventorySummary(items, now, 7);

  assert.equal(summary.featuredActive.length, 4);
  assert.equal(summary.featuredExpired.length, 1);
  assert.equal(summary.featuredExpiringSoon.length, 1);
  assert.equal(summary.featuredExpiringSoon[0].id, "d");
  assert.deepEqual(summary.featuredActive.map((item) => item.id), ["b", "a", "d", "c"]);
  assert.equal(summary.countsByCity.Lagos, 3);
  assert.equal(summary.countsByCity.Accra, 1);
});
