import test from "node:test";
import assert from "node:assert/strict";

import { getAdminAccessState, shouldShowProfileMissing } from "../../lib/admin/user-view";

void test("admin onboarding incomplete keeps view read-only with banner", () => {
  const state = getAdminAccessState({
    role: "admin",
    onboarding_completed: false,
  });

  assert.equal(state.isAdmin, true);
  assert.equal(state.actionsDisabled, true);
  assert.equal(state.showOnboardingBanner, true);
});

void test("profile missing is suppressed when service role is unavailable", () => {
  assert.equal(shouldShowProfileMissing(null, false), false);
});
