import test from "node:test";
import assert from "node:assert/strict";
import {
  getWorkspaceSidebarItems,
  normalizeWorkspaceRole,
} from "@/lib/workspace/sidebar-model";

void test("normalizeWorkspaceRole handles known roles and super_admin sentinel", () => {
  assert.equal(normalizeWorkspaceRole("agent"), "agent");
  assert.equal(normalizeWorkspaceRole("LANDLORD"), "landlord");
  assert.equal(normalizeWorkspaceRole("super_admin"), "admin");
  assert.equal(normalizeWorkspaceRole("unknown"), null);
});

void test("landlord sidebar items are limited to core host workspace links", () => {
  const items = getWorkspaceSidebarItems({
    role: "landlord",
    awaitingApprovalCount: 4,
    unreadMessages: 9,
  });

  assert.deepEqual(
    items.map((item) => item.href),
    ["/host", "/host/listings", "/host/bookings", "/host/calendar", "/host/earnings"]
  );
  assert.equal(items.find((item) => item.href === "/host/bookings")?.badgeCount, 4);
  assert.equal(
    items.some((item) => item.href === "/dashboard/messages"),
    false,
    "landlord sidebar must not include agent-only messaging shortcut"
  );
});

void test("agent sidebar extends landlord links with agent workspace links", () => {
  const items = getWorkspaceSidebarItems({
    role: "agent",
    awaitingApprovalCount: 2,
    unreadMessages: 3,
  });

  assert.ok(items.some((item) => item.href === "/profile/clients"));
  assert.ok(items.some((item) => item.href === "/dashboard/leads"));
  assert.ok(items.some((item) => item.href === "/dashboard/referrals"));
  assert.ok(items.some((item) => item.href === "/dashboard/messages"));
  assert.ok(items.some((item) => item.href === "/dashboard/agent-network"));
  assert.equal(items.find((item) => item.href === "/dashboard/messages")?.badgeCount, 3);
});

void test("tenant and unknown roles receive no workspace sidebar items", () => {
  assert.deepEqual(getWorkspaceSidebarItems({ role: "tenant" }), []);
  assert.deepEqual(getWorkspaceSidebarItems({ role: null }), []);
});
