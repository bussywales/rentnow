import test from "node:test";
import assert from "node:assert/strict";
import { validateResubmitStatus, isResubmitAllowed } from "@/lib/properties/resubmit";

void test("validateResubmitStatus only allows changes_requested", () => {
  const ok = validateResubmitStatus("changes_requested");
  assert.equal(ok.ok, true);
  const bad = validateResubmitStatus("pending");
  assert.equal(bad.ok, false);
});

void test("isResubmitAllowed allows owner or admin", () => {
  assert.equal(isResubmitAllowed({ userId: "u1", ownerId: "u1", role: "landlord" }), true);
  assert.equal(isResubmitAllowed({ userId: "u1", ownerId: "u2", role: "admin" }), true);
  assert.equal(isResubmitAllowed({ userId: "u1", ownerId: "u2", role: "tenant" }), false);
});
