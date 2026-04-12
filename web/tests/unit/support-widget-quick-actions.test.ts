import test from "node:test";
import assert from "node:assert/strict";
import { buildSupportWidgetQuickActions } from "@/lib/support/widget-quick-actions";

void test("support widget shows tenant-first discovery actions on public routes", () => {
  const actions = buildSupportWidgetQuickActions({ pathname: "/", role: null });

  assert.deepEqual(
    actions.slice(0, 4).map((action) => action.label),
    ["Search and alerts", "Requests and enquiries", "Bookings and stays", "Account and access"]
  );
  assert.equal(actions.at(-2)?.label, "Report an issue");
  assert.equal(actions.at(-1)?.label, "Contact support");
});

void test("support widget prioritises shortlet help on shortlet routes", () => {
  const actions = buildSupportWidgetQuickActions({ pathname: "/shortlets/lagos", role: null });

  assert.deepEqual(
    actions.slice(0, 3).map((action) => action.label),
    ["Bookings and stays", "Check-in and house rules", "Booking timing and payments"]
  );
});

void test("support widget prioritises landlord listing workflows for host surfaces", () => {
  const actions = buildSupportWidgetQuickActions({ pathname: "/host", role: null });

  assert.deepEqual(
    actions.slice(0, 4).map((action) => action.label),
    ["Listings and publishing", "Billing and plans", "QR and sign kit", "Requests and enquiries"]
  );
});

void test("support widget swaps in Move & Ready help on host services routes", () => {
  const actions = buildSupportWidgetQuickActions({ pathname: "/host/services/new", role: "landlord" });

  assert.equal(actions[0]?.label, "Move & Ready services");
  assert.equal(actions[0]?.href, "/help/host/services");
});

void test("support widget uses agent-specific help actions for agents", () => {
  const actions = buildSupportWidgetQuickActions({ pathname: "/dashboard", role: "agent" });

  assert.deepEqual(
    actions.slice(0, 4).map((action) => action.label),
    ["Listings and publishing", "Billing and plans", "QR and sign kit", "Referrals"]
  );
  assert.equal(actions[3]?.href, "/help/agent/referrals");
});
