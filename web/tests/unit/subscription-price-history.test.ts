import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSubscriptionPriceHistoryHref,
  formatSubscriptionPriceAuditEventLabel,
  parseAdminSubscriptionPriceAuditFilters,
} from "@/lib/billing/subscription-price-history";

void test("subscription price history parser normalizes filters and page safely", () => {
  const filters = parseAdminSubscriptionPriceAuditFilters({
    market: "ca",
    role: "landlord",
    cadence: "monthly",
    eventType: "published",
    actorId: "admin-1",
    dateFrom: "2026-04-01",
    dateTo: "2026-04-11",
    page: "3",
  });

  assert.equal(filters.market, "CA");
  assert.equal(filters.role, "landlord");
  assert.equal(filters.cadence, "monthly");
  assert.equal(filters.eventType, "published");
  assert.equal(filters.actorId, "admin-1");
  assert.equal(filters.dateFrom, "2026-04-01");
  assert.equal(filters.dateTo, "2026-04-11");
  assert.equal(filters.page, 3);
});

void test("subscription price history href builder preserves row scope and filters", () => {
  const href = buildSubscriptionPriceHistoryHref({
    marketCountry: "CA",
    role: "landlord",
    cadence: "monthly",
    eventType: "draft_updated",
    actorId: "admin-1",
    page: 2,
  });

  assert.equal(
    href,
    "/admin/settings/billing/prices/history?market=CA&role=landlord&cadence=monthly&eventType=draft_updated&actorId=admin-1&page=2"
  );
});

void test("subscription price audit event labels stay operator-readable", () => {
  assert.equal(formatSubscriptionPriceAuditEventLabel("draft_created"), "Draft created");
  assert.equal(formatSubscriptionPriceAuditEventLabel("stripe_price_created"), "Stripe price created");
  assert.equal(formatSubscriptionPriceAuditEventLabel("published"), "Published");
});
