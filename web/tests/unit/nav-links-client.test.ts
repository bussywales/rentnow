import test from "node:test";
import assert from "node:assert/strict";

import {
  MAIN_NAV_LINKS,
  applyHostBookingsBadge,
  resolveDesktopTopNavLinks,
} from "@/components/layout/MainNav";
import { resolveNavLinks } from "@/components/layout/NavLinksClient";

test("admin desktop nav stays focused on the core admin destination", () => {
  const links = resolveDesktopTopNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "admin" });
  const labels = links.map((link) => link.label);
  assert.ok(labels.includes("Admin"));
  assert.equal(labels.includes("Help Tutorials"), false);
  assert.deepEqual(labels, ["Admin"]);
});

test("host desktop nav keeps bookings, calendar, listings, and earnings", () => {
  const links = resolveDesktopTopNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "landlord" });
  assert.deepEqual(
    links.map((link) => link.href),
    ["/host/bookings", "/host/calendar", "/host/listings", "/host/earnings"]
  );
  assert.equal(links.some((link) => link.href === "/dashboard/billing"), false);
});

test("tenant desktop nav keeps shortlets, properties, trips, and saved", () => {
  const links = resolveDesktopTopNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "tenant" });
  assert.deepEqual(
    links.map((link) => link.href),
    ["/shortlets", "/properties", "/trips", "/tenant/saved"]
  );
});

test("tenant request links stay drawer-only and do not change desktop top nav", () => {
  const links = resolveDesktopTopNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "tenant" });
  assert.equal(
    links.some(
      (link) =>
        link.href === "/requests/new" ||
        link.href === "/requests/my" ||
        link.href === "/tenant/billing"
    ),
    false
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

test("non-admin roles do not see help tutorials in the main nav link set", () => {
  const tenantLinks = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "tenant" });
  const hostLinks = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "landlord" });
  const agentLinks = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "agent" });
  const adminLinks = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "admin" });
  const guestLinks = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: false, role: null });

  assert.equal(tenantLinks.some((link) => link.href === "/admin/help/tutorials"), false);
  assert.equal(hostLinks.some((link) => link.href === "/admin/help/tutorials"), false);
  assert.equal(agentLinks.some((link) => link.href === "/admin/help/tutorials"), false);
  assert.equal(adminLinks.some((link) => link.href === "/tenant/billing"), false);
  assert.equal(adminLinks.some((link) => link.href === "/dashboard/billing"), false);
  assert.equal(guestLinks.some((link) => link.href === "/admin/help/tutorials"), false);
});

test("role-aware nav resolves the correct billing route per authenticated role", () => {
  const tenantLinks = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "tenant" });
  const landlordLinks = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "landlord" });
  const agentLinks = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "agent" });

  assert.ok(tenantLinks.find((link) => link.href === "/tenant/billing"));
  assert.equal(tenantLinks.some((link) => link.href === "/dashboard/billing"), false);

  assert.ok(landlordLinks.find((link) => link.href === "/dashboard/billing"));
  assert.equal(landlordLinks.some((link) => link.href === "/tenant/billing"), false);

  assert.ok(agentLinks.find((link) => link.href === "/dashboard/billing"));
  assert.equal(agentLinks.some((link) => link.href === "/tenant/billing"), false);
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
  assert.equal(
    links.some((link) => link.href === "/dashboard/leads"),
    false,
    "host nav should not expose legacy dashboard leads href"
  );
});
