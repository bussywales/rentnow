import test from "node:test";
import assert from "node:assert/strict";
import { resolvePropertyCheckinErrorMessage } from "@/components/properties/property-checkin-errors";

void test("property check-in error copy distinguishes login from authorization", () => {
  assert.equal(
    resolvePropertyCheckinErrorMessage(401, { error: "Unauthorized" }),
    "Please log in to check in."
  );
  assert.equal(
    resolvePropertyCheckinErrorMessage(403, {
      error: "You’re signed in, but only the listing owner or a delegated manager can check in here.",
      code: "listing_relation_required",
    }),
    "You’re signed in, but only the listing owner or a delegated manager can check in here."
  );
  assert.equal(
    resolvePropertyCheckinErrorMessage(403, { error: "Forbidden", code: "role_not_allowed" }),
    "Property check-in is available to admins, landlords, and delegated agents."
  );
});
