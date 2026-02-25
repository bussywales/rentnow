import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceActivityRail } from "@/components/home/WorkspaceActivityRail";

void test("activity rail renders recent events for landlord and agent workspace roles", () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspaceActivityRail, {
      role: "landlord",
      items: [
        {
          id: "booking:1",
          type: "booking_request",
          label: "Booking request",
          title: "Booking request awaiting approval",
          subtitle: "Ocean View • Lagos",
          createdAt: "2026-02-24T11:00:00.000Z",
          href: "/host/bookings?view=awaiting_approval&booking=booking-1",
          ctaLabel: "Open booking",
          severity: "action_required",
          badge: "Urgent",
        },
      ],
    })
  );

  assert.match(html, /Recent activity/);
  assert.match(html, /Booking request awaiting approval/);
  assert.match(html, /Urgent/);
  assert.match(html, /Booking request/);
  assert.match(html, /Open booking/);
  assert.match(html, /View all/);
  assert.match(html, /data-testid=\"workspace-activity-rail\"/);
  assert.match(html, /data-testid=\"workspace-activity-item\"/);
  assert.match(html, /data-testid=\"workspace-activity-badge-booking_request\"/);
  assert.match(html, /data-testid=\"workspace-activity-cta\"/);
});

void test("activity rail is hidden for tenant role", () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspaceActivityRail, {
      role: "tenant",
      items: [],
    })
  );

  assert.equal(html, "");
});

void test("activity rail shows compact empty state when no events are available", () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspaceActivityRail, {
      role: "agent",
      items: [],
    })
  );

  assert.match(html, /No new activity yet/);
  assert.match(html, /Open leads/);
});
