import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAdminUsersQuery,
  filterAdminUsers,
  getAdminUserStatus,
  type AdminUserRow,
} from "../../lib/admin/admin-users";

void test("parseAdminUsersQuery normalizes params", () => {
  const query = parseAdminUsersQuery({
    q: "  alice@example.com ",
    role: "admin",
    status: "pending",
    plan: "pro",
    page: "2",
    pageSize: "40",
  });

  assert.equal(query.q, "alice@example.com");
  assert.equal(query.role, "admin");
  assert.equal(query.status, "pending");
  assert.equal(query.plan, "pro");
  assert.equal(query.page, 2);
  assert.equal(query.pageSize, 40);
});

void test("filterAdminUsers matches query text and status", () => {
  const base: Omit<AdminUserRow, "id" | "email" | "fullName"> = {
    createdAt: null,
    lastSignInAt: null,
    role: "tenant",
    onboardingCompleted: true,
    planTier: "free",
    maxListingsOverride: null,
    validUntil: null,
    billingNotes: null,
    billingSource: null,
    stripeStatus: null,
    stripeCurrentPeriodEnd: null,
    pendingCount: 0,
    profileMissing: false,
  };

  const users: AdminUserRow[] = [
    {
      ...base,
      id: "user-1",
      email: "alice@example.com",
      fullName: "Alice Smith",
      role: "admin",
      planTier: "pro",
      pendingCount: 1,
    },
    {
      ...base,
      id: "user-2",
      email: "bob@example.com",
      fullName: "Bob Tenant",
      role: "tenant",
      planTier: "free",
    },
  ];

  const filtered = filterAdminUsers(users, {
    q: "alice",
    role: "all",
    status: "pending",
    plan: "all",
    page: 1,
    pageSize: 25,
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].email, "alice@example.com");
  assert.equal(getAdminUserStatus(filtered[0]), "pending");
});
