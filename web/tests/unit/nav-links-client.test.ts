import test from "node:test";
import assert from "node:assert/strict";

import {
  MAIN_NAV_LINKS,
  applyHostBookingsBadge,
  resolveDesktopTopNavLinks,
} from "@/components/layout/MainNav";
import { resolveNavLinks } from "@/components/layout/NavLinksClient";

test("admin desktop nav stays minimal", () => {
  const links = resolveDesktopTopNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "admin" });
  const labels = links.map((link) => link.label);
  assert.ok(labels.includes("Admin"));
  assert.deepEqual(labels, ["Admin"]);
});

test("host desktop nav keeps bookings, calendar, listings, and earnings", () => {
  const links = resolveDesktopTopNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "landlord" });
  assert.deepEqual(
    links.map((link) => link.href),
    ["/host/bookings", "/host/calendar", "/host/listings", "/host/earnings"]
  );
});

test("tenant desktop nav keeps shortlets, properties, trips, and saved", () => {
  const links = resolveDesktopTopNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "tenant" });
  assert.deepEqual(
    links.map((link) => link.href),
    ["/shortlets", "/properties", "/trips", "/tenant/saved"]
  );
});

test("guest desktop nav exposes shortlets and properties only", () => {
  const links = resolveDesktopTopNavLinks(MAIN_NAV_LINKS, { isAuthed: false, role: null });
  assert.deepEqual(links.map((link) => link.href), ["/shortlets", "/properties"]);
});

test("resolveNavLinks still allows extended admin links for drawer contexts", () => {
  const links = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "admin" });
  assert.ok(links.find((link) => link.href === "/admin/support"));
  assert.ok(links.find((link) => link.href === "/admin/legal"));
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

test("host nav includes earnings entry point", () => {
  const links = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "landlord" });
  const earnings = links.find((link) => link.href === "/host/earnings");
  assert.ok(earnings, "expected earnings link for host role");
});
