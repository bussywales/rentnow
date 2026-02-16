import test from "node:test";
import assert from "node:assert/strict";
import { getPublicVisibilityDiagnostics } from "@/lib/properties/public-visibility-diagnostics";

void test("public visibility diagnostics reports visible listings cleanly", () => {
  const diagnostics = getPublicVisibilityDiagnostics({
    status: "live",
    is_active: true,
    is_approved: true,
    expires_at: null,
    is_demo: false,
  });

  assert.equal(diagnostics.isVisible, true);
  assert.deepEqual(diagnostics.blockers, []);
});

void test("public visibility diagnostics reports approval/status blockers", () => {
  const diagnostics = getPublicVisibilityDiagnostics({
    status: "pending",
    is_active: true,
    is_approved: false,
    expires_at: null,
    is_demo: false,
  });

  assert.equal(diagnostics.isVisible, false);
  assert.ok(diagnostics.blockers.includes("Status is not live yet."));
  assert.ok(diagnostics.blockers.includes("Listing is awaiting approval."));
});

void test("public visibility diagnostics reports demo and expiry blockers", () => {
  const diagnostics = getPublicVisibilityDiagnostics(
    {
      status: "live",
      is_active: true,
      is_approved: true,
      expires_at: "2020-01-01T00:00:00.000Z",
      is_demo: true,
    },
    new Date("2026-02-16T00:00:00.000Z")
  );

  assert.equal(diagnostics.isVisible, false);
  assert.ok(diagnostics.blockers.includes("Demo listings are hidden from public browse."));
  assert.ok(diagnostics.blockers.includes("Listing has expired."));
});
