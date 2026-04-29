import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveLegacyDashboardPropertyRedirect,
  buildHostPropertyAvailabilityHref,
  buildHostPropertyEditHref,
} from "@/lib/routing/dashboard-properties-legacy";

void test("authed landlord dashboard edit route redirects to canonical host edit surface", () => {
  const target = resolveLegacyDashboardPropertyRedirect({
    userPresent: true,
    role: "landlord",
    propertyId: "a0708ca9-2b3c-406a-9d6f-c625d05a8d12",
    searchParams: { step: "photos", back: "/host/listings?view=all" },
  });

  assert.equal(
    target,
    "/host/properties/a0708ca9-2b3c-406a-9d6f-c625d05a8d12/edit?step=photos&back=%2Fhost%2Flistings%3Fview%3Dall"
  );
});

void test("legacy dashboard availability route preserves canonical host availability target", () => {
  const target = resolveLegacyDashboardPropertyRedirect({
    userPresent: true,
    role: "landlord",
    propertyId: "listing-123",
    searchParams: { back: "/host/properties" },
    targetSurface: "availability",
  });

  assert.equal(target, "/host/properties/listing-123/availability?back=%2Fhost%2Fproperties");
});

void test("unauthenticated dashboard edit route keeps login redirect behaviour", () => {
  const target = resolveLegacyDashboardPropertyRedirect({
    userPresent: false,
    role: null,
    propertyId: "a0708ca9-2b3c-406a-9d6f-c625d05a8d12",
    searchParams: {},
  });

  assert.equal(target, "/auth/login?reason=auth");
});

void test("tenant dashboard edit route redirects to tenant-safe route", () => {
  const target = resolveLegacyDashboardPropertyRedirect({
    userPresent: true,
    role: "tenant",
    propertyId: "a0708ca9-2b3c-406a-9d6f-c625d05a8d12",
    searchParams: {},
  });

  assert.equal(target, "/tenant/home");
});

void test("invalid dashboard property id falls back to host listings manager view", () => {
  const target = resolveLegacyDashboardPropertyRedirect({
    userPresent: true,
    role: "landlord",
    propertyId: "   ",
    searchParams: {},
  });

  assert.equal(target, "/host/listings?view=manage");
});

void test("host availability href builder preserves query params", () => {
  const href = buildHostPropertyAvailabilityHref("listing-123", {
    step: "submit",
    back: "/host/properties",
    tag: ["a", "b"],
  });

  assert.equal(
    href,
    "/host/properties/listing-123/availability?step=submit&back=%2Fhost%2Fproperties&tag=a&tag=b"
  );
});

void test("host edit href builder preserves submit recovery query params", () => {
  const href = buildHostPropertyEditHref("listing-123", {
    step: "submit",
    monetization: "payment_required",
    monetization_context: "renewal",
  });

  assert.equal(
    href,
    "/host/properties/listing-123/edit?step=submit&monetization=payment_required&monetization_context=renewal"
  );
});
