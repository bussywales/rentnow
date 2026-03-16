import test from "node:test";
import assert from "node:assert/strict";
import {
  getWorkspaceSidebarItems,
  getWorkspaceSidebarSections,
  normalizeWorkspaceRole,
} from "@/lib/workspace/sidebar-model";

void test("normalizeWorkspaceRole handles known roles and super_admin sentinel", () => {
  assert.equal(normalizeWorkspaceRole("agent"), "agent");
  assert.equal(normalizeWorkspaceRole("LANDLORD"), "landlord");
  assert.equal(normalizeWorkspaceRole("super_admin"), "admin");
  assert.equal(normalizeWorkspaceRole("unknown"), null);
});

void test("landlord sidebar items are limited to core host workspace links", () => {
  const sections = getWorkspaceSidebarSections({
    role: "landlord",
    awaitingApprovalCount: 4,
    unreadMessages: 9,
  });
  const items = sections.flatMap((section) => section.items);

  assert.deepEqual(sections.map((section) => section.label), ["Core"]);
  assert.deepEqual(
    items.map((item) => item.href),
    ["/host", "/host/listings", "/requests", "/host/bookings", "/host/calendar", "/host/earnings"]
  );
  assert.equal(items.find((item) => item.href === "/host/bookings")?.badgeCount, 4);
  assert.equal(
    items.find((item) => item.href === "/requests")?.label,
    "Property Requests"
  );
  assert.equal(
    items.some((item) => item.href === "/dashboard/messages"),
    false,
    "landlord sidebar must not include agent-only messaging shortcut"
  );
});

void test("agent sidebar extends landlord links with agent workspace links", () => {
  const sections = getWorkspaceSidebarSections({
    role: "agent",
    awaitingApprovalCount: 2,
    unreadMessages: 3,
  });
  const items = sections.flatMap((section) => section.items);

  assert.deepEqual(sections.map((section) => section.label), [
    "Core",
    "Agent tools",
    "Legacy tools",
  ]);
  assert.ok(items.some((item) => item.href === "/profile/clients"));
  assert.ok(items.some((item) => item.href === "/host/leads"));
  assert.ok(items.some((item) => item.href === "/requests"));
  assert.ok(items.some((item) => item.href === "/dashboard/referrals"));
  assert.ok(items.some((item) => item.href === "/dashboard/messages"));
  assert.ok(items.some((item) => item.href === "/dashboard/agent-network"));
  assert.ok(items.some((item) => item.href === "/dashboard/analytics"));
  assert.equal(items.find((item) => item.href === "/dashboard/messages")?.badgeCount, 3);
});

void test("tenant and unknown roles receive no workspace sidebar items", () => {
  assert.deepEqual(getWorkspaceSidebarItems({ role: "tenant" }), []);
  assert.deepEqual(getWorkspaceSidebarItems({ role: null }), []);
});
