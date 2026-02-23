import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveLegacyDashboardPropertyRedirect,
  buildHostPropertyEditHref,
} from "@/lib/routing/dashboard-properties-legacy";

void test("authed landlord dashboard edit route redirects to canonical host editor", () => {
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

void test("host edit href builder preserves query params", () => {
  const href = buildHostPropertyEditHref("listing-123", {
    step: "submit",
    back: "/host/properties",
    tag: ["a", "b"],
  });

  assert.equal(
    href,
    "/host/properties/listing-123/edit?step=submit&back=%2Fhost%2Fproperties&tag=a&tag=b"
  );
});

