import test from "node:test";
import assert from "node:assert/strict";

import {
  getListingAccessResult,
  getListingCta,
  shouldShowSavedSearchNav,
} from "../../lib/role-access";

void test("listing CTA varies by role", () => {
  assert.deepEqual(getListingCta(null), {
    label: "List a property",
    href: "/auth/login?reason=auth",
  });
  assert.deepEqual(getListingCta("tenant"), {
    label: "Find a home",
    href: "/properties",
  });
  assert.deepEqual(getListingCta("landlord"), {
    label: "List a property",
    href: "/dashboard/properties/new",
  });
  assert.deepEqual(getListingCta("agent"), {
    label: "List a property",
    href: "/dashboard/properties/new",
  });
});

void test("saved searches nav is tenant-only", () => {
  assert.equal(shouldShowSavedSearchNav("tenant"), true);
  assert.equal(shouldShowSavedSearchNav("landlord"), false);
  assert.equal(shouldShowSavedSearchNav("agent"), false);
  assert.equal(shouldShowSavedSearchNav(null), false);
});

void test("listing access rejects tenants and unauthenticated users", () => {
  const unauth = getListingAccessResult(null, false);
  assert.equal(unauth.ok, false);
  if (!unauth.ok) {
    assert.equal(unauth.code, "not_authenticated");
    assert.equal(unauth.status, 401);
  }

  const tenant = getListingAccessResult("tenant", true);
  assert.equal(tenant.ok, false);
  if (!tenant.ok) {
    assert.equal(tenant.code, "role_not_allowed");
    assert.equal(tenant.status, 403);
  }

  const landlord = getListingAccessResult("landlord", true);
  assert.equal(landlord.ok, true);
});
