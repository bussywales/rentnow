import test from "node:test";
import assert from "node:assert/strict";
import { classifyRevenueSignals, REVENUE_SIGNAL_THRESHOLDS } from "@/lib/admin/revenue-signals.server";
import type { PropertyEventSummary } from "@/lib/analytics/property-events";

const now = new Date("2026-02-04T12:00:00.000Z");

const baseSummary: PropertyEventSummary = {
  propertyId: "listing-1",
  views: 120,
  uniqueViews: 100,
  saveToggles: 0,
  netSaves: 10,
  enquiries: 0,
  viewingRequests: 0,
  shares: 0,
  featuredImpressions: 0,
  featuredClicks: 0,
  featuredLeads: 0,
  lastOccurredAt: null,
};

void test("classifyRevenueSignals flags high demand low conversion", () => {
  const listing = {
    id: "listing-1",
    title: "Test listing",
    city: "Lagos",
    status: "live",
    owner_id: "host-1",
    is_featured: false,
  };

  const signals = classifyRevenueSignals({
    listing,
    summary: baseSummary,
    missedDemand: { state: "not_applicable", missed: null, averageDaily: null, liveDays: 0, daysPaused: 0 },
    now,
  });

  assert.ok(signals.some((signal) => signal.type === "HIGH_DEMAND_LOW_CONVERSION"));
});

void test("classifyRevenueSignals flags missed demand when paused", () => {
  const listing = {
    id: "listing-2",
    title: "Paused listing",
    city: "Abuja",
    status: "paused_owner",
    owner_id: "host-2",
    is_featured: false,
  };

  const signals = classifyRevenueSignals({
    listing,
    summary: baseSummary,
    missedDemand: { state: "ok", missed: REVENUE_SIGNAL_THRESHOLDS.missedDemandMin + 1, averageDaily: 5, liveDays: 5, daysPaused: 3 },
    now,
  });

  assert.ok(signals.some((signal) => signal.type === "MISSED_DEMAND_WHILE_PAUSED"));
});

void test("classifyRevenueSignals flags featured expired high performance", () => {
  const listing = {
    id: "listing-3",
    title: "Featured listing",
    city: "Kano",
    status: "live",
    owner_id: "host-3",
    is_featured: false,
    featured_until: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const summary = {
    ...baseSummary,
    featuredImpressions: REVENUE_SIGNAL_THRESHOLDS.featuredHighImpressions + 10,
  };

  const signals = classifyRevenueSignals({
    listing,
    summary,
    missedDemand: { state: "not_applicable", missed: null, averageDaily: null, liveDays: 0, daysPaused: 0 },
    now,
  });

  assert.ok(signals.some((signal) => signal.type === "FEATURED_EXPIRED_HIGH_PERFORMANCE"));
});

void test("classifyRevenueSignals flags high interest for sale", () => {
  const listing = {
    id: "listing-4",
    title: "For sale listing",
    city: "Lagos",
    status: "live",
    owner_id: "host-4",
    is_featured: false,
    listing_intent: "buy",
  };

  const summary = {
    ...baseSummary,
    views: REVENUE_SIGNAL_THRESHOLDS.saleInterestViews + 5,
    uniqueViews: REVENUE_SIGNAL_THRESHOLDS.saleInterestViews + 5,
    netSaves: REVENUE_SIGNAL_THRESHOLDS.saleInterestSaves + 1,
  };

  const signals = classifyRevenueSignals({
    listing,
    summary,
    missedDemand: { state: "not_applicable", missed: null, averageDaily: null, liveDays: 0, daysPaused: 0 },
    now,
  });

  assert.ok(signals.some((signal) => signal.type === "HIGH_INTEREST_FOR_SALE"));
});
