import { test } from "node:test";
import assert from "node:assert/strict";
import { filterShortletHomesForDiscovery } from "@/lib/tenant/tenant-discovery.server";

function makeHome(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: `prop-${Math.random()}`,
    status: "live",
    is_active: true,
    is_approved: true,
    is_demo: false,
    expires_at: null,
    listing_intent: "shortlet",
    rental_type: "short_let",
    shortlet_settings: [{ booking_mode: "instant", nightly_price_minor: 120000 }],
    ...overrides,
  };
}

test("filterShortletHomesForDiscovery keeps only visible shortlet homes", () => {
  const nowIso = "2026-02-15T10:00:00.000Z";
  const homes = [
    makeHome({ id: "ok-shortlet" }),
    makeHome({ id: "draft-status", status: "draft" }),
    makeHome({ id: "expired-shortlet", expires_at: "2026-02-10T00:00:00.000Z" }),
    makeHome({ id: "not-shortlet", listing_intent: "rent_lease", rental_type: "long_term", shortlet_settings: [] }),
    makeHome({ id: "settings-only-shortlet", listing_intent: "rent_lease", rental_type: "long_term", shortlet_settings: [{ booking_mode: "request", nightly_price_minor: 90000 }] }),
  ] as never[];

  const filtered = filterShortletHomesForDiscovery(homes, { nowIso, includeDemo: false });
  assert.deepEqual(
    filtered.map((home) => home.id),
    ["ok-shortlet", "settings-only-shortlet"]
  );
});
