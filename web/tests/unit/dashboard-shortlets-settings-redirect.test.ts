import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHostShortletSettingsHref,
  resolveLegacyDashboardShortletSettingsRedirect,
} from "@/lib/routing/dashboard-shortlets-legacy";

void test("authed landlord dashboard shortlet settings redirects to canonical host settings surface", () => {
  const target = resolveLegacyDashboardShortletSettingsRedirect({
    userPresent: true,
    role: "landlord",
    propertyId: "a0708ca9-2b3c-406a-9d6f-c625d05a8d12",
    searchParams: { tab: "rules", back: "/host/listings" },
  });

  assert.equal(
    target,
    "/host/shortlets/a0708ca9-2b3c-406a-9d6f-c625d05a8d12/settings?tab=rules&back=%2Fhost%2Flistings"
  );
});

void test("unauthenticated dashboard shortlet settings keeps login redirect behaviour", () => {
  const target = resolveLegacyDashboardShortletSettingsRedirect({
    userPresent: false,
    role: null,
    propertyId: "a0708ca9-2b3c-406a-9d6f-c625d05a8d12",
    searchParams: {},
  });

  assert.equal(target, "/auth/login?reason=auth");
});

void test("tenant dashboard shortlet settings redirects to tenant-safe route", () => {
  const target = resolveLegacyDashboardShortletSettingsRedirect({
    userPresent: true,
    role: "tenant",
    propertyId: "a0708ca9-2b3c-406a-9d6f-c625d05a8d12",
    searchParams: {},
  });

  assert.equal(target, "/tenant/home");
});

void test("invalid dashboard shortlet id falls back to host listings manager view", () => {
  const target = resolveLegacyDashboardShortletSettingsRedirect({
    userPresent: true,
    role: "landlord",
    propertyId: "undefined",
    searchParams: {},
  });

  assert.equal(target, "/host/listings?view=manage");
});

void test("host shortlet settings href builder preserves query params", () => {
  const href = buildHostShortletSettingsHref("listing-123", {
    tab: "arrival",
    back: "/host/properties",
    mode: ["compact", "full"],
  });

  assert.equal(
    href,
    "/host/shortlets/listing-123/settings?tab=arrival&back=%2Fhost%2Fproperties&mode=compact&mode=full"
  );
});
