import test from "node:test";
import assert from "node:assert/strict";

import { MAIN_NAV_LINKS, applyHostBookingsBadge } from "@/components/layout/MainNav";
import { resolveNavLinks } from "@/components/layout/NavLinksClient";

test("admin nav shows Admin and hides Dashboard", () => {
  const links = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "admin" });
  const labels = links.map((link) => link.label);
  assert.ok(labels.includes("Admin"));
  assert.ok(labels.includes("Insights"));
  assert.ok(!labels.includes("Dashboard"));
});

test("non-admin nav keeps Dashboard", () => {
  const links = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "landlord" });
  const labels = links.map((link) => link.label);
  assert.ok(labels.includes("Dashboard"));
  assert.ok(!labels.includes("Insights"));
});

test("tenant nav includes Trips", () => {
  const links = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "tenant" });
  const trips = links.find((link) => link.href === "/trips");
  assert.ok(trips, "expected trips link for tenant role");
});

test("host bookings nav badge appears when awaiting approvals exist", () => {
  const withBadge = applyHostBookingsBadge(MAIN_NAV_LINKS, 3);
  const bookingsLink = withBadge.find((link) => link.href === "/host/bookings");
  assert.ok(bookingsLink, "expected host bookings link");
  assert.equal(bookingsLink?.badgeCount, 3);
});

test("host bookings nav badge stays hidden when there are no awaiting approvals", () => {
  const withBadge = applyHostBookingsBadge(MAIN_NAV_LINKS, 0);
  const bookingsLink = withBadge.find((link) => link.href === "/host/bookings");
  assert.ok(bookingsLink, "expected host bookings link");
  assert.equal(bookingsLink?.badgeCount ?? null, null);
});
