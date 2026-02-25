import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createFxSnapshot } from "@/lib/fx/fx";
import type { HostEarningsTimeline } from "@/lib/shortlet/host-earnings";
import { HostEarningsTimelineView } from "@/components/host/HostEarningsTimeline";

const timelineFixture: HostEarningsTimeline = {
  summary: {
    pendingApprovalCount: 1,
    upcomingCount: 1,
    inProgressCount: 0,
    completedUnpaidCount: 1,
    paidCount: 1,
    grossEarningsMinor: 10_002_30,
    paidOutMinor: 5_001_00,
    availableToPayoutMinor: 5_001_30,
    grossEarningsByCurrencyMinor: {
      NGN: 1_000_000_00,
      GBP: 230,
    },
    paidOutByCurrencyMinor: {
      NGN: 500_000_00,
      GBP: 100,
    },
    availableToPayoutByCurrencyMinor: {
      NGN: 500_000_00,
      GBP: 130,
    },
  },
  items: [
    {
      bookingId: "booking-1",
      propertyId: "property-1",
      title: "Ocean View",
      city: "Lagos",
      checkIn: "2026-02-20",
      checkOut: "2026-02-22",
      nights: 2,
      bookingStatus: "confirmed",
      paymentStatus: "succeeded",
      totalMinor: 12_000_00,
      feesMinor: 2_000_00,
      hostEarningsMinor: 10_000_00,
      currency: "NGN",
      payoutStatus: "pending",
      payoutReason: undefined,
      payoutRequestStatus: "not_requested",
      payoutRequestedAt: undefined,
      payoutRequestedMethod: undefined,
      payoutRequestedNote: undefined,
      paidAt: undefined,
      payoutMethod: undefined,
      payoutReference: undefined,
    },
  ],
};

void test("host earnings renders fx approx lines with rates date when snapshot is available", () => {
  const snapshot = createFxSnapshot({
    date: "2026-02-25",
    baseCurrency: "USD",
    rates: { NGN: 1500, GBP: 0.8, CAD: 1.35 },
    source: "fixture",
    fetchedAt: "2026-02-25T02:15:00.000Z",
  });
  assert.ok(snapshot);

  const html = renderToStaticMarkup(
    React.createElement(HostEarningsTimelineView, {
      timeline: timelineFixture,
      marketCurrency: "CAD",
      fxSnapshot: snapshot,
    })
  );

  assert.match(html, /data-testid="host-earnings-summary-available-approx"/);
  assert.match(html, /data-testid="host-earnings-summary-paid-approx"/);
  assert.match(html, /data-testid="host-earnings-summary-gross-approx"/);
  assert.match(html, /Approx:/);
  assert.match(html, /\(rates 2026-02-25\)/);
});

void test("host earnings hides approx lines and shows unavailable hint when required rates are missing", () => {
  const snapshot = createFxSnapshot({
    date: "2026-02-25",
    baseCurrency: "USD",
    rates: { NGN: 1500, CAD: 1.35 },
    source: "fixture",
    fetchedAt: "2026-02-25T02:15:00.000Z",
  });
  assert.ok(snapshot);

  const html = renderToStaticMarkup(
    React.createElement(HostEarningsTimelineView, {
      timeline: timelineFixture,
      marketCurrency: "CAD",
      fxSnapshot: snapshot,
    })
  );

  assert.match(html, /Approx unavailable \(missing rates\)\./);
  assert.match(html, /Approx uses daily exchange rates\. Payouts remain in the booking currency\./);
  assert.doesNotMatch(html, /data-testid="host-earnings-summary-gross-approx"/);
});
